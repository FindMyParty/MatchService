import { createProfile } from '../../../domain/entities/profile.js'
import { CreateMatchUseCase } from '../../../domain/use-cases/create-match.js'
import { env } from '../../../config/env.js'
import { logger } from '../../../shared/logger.js'

/**
 * @param {import('amqplib').Channel} channel
 * @param {import('../../../adapters/outbound/db/profile-repository.js').ProfileRepository} profileRepository
 */
export async function registerSubscribers(channel, profileRepository) {
  const EXCHANGE = env.RABBITMQ_PROFILE_EXCHANGE
  const QUEUE = env.RABBITMQ_PROFILE_QUEUE
  const DLQ = `${QUEUE}.dlq`
  const BINDING_KEY = env.RABBITMQ_PROFILE_BINDING_KEY

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
  await channel.assertExchange(DLQ, 'topic', { durable: true })
  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLQ,
    },
  })
  await channel.bindQueue(QUEUE, EXCHANGE, BINDING_KEY)

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return

    let payload
    try {
      payload = JSON.parse(msg.content.toString())
    } catch (err) {
      logger.error({ err }, 'Failed to parse message from queue')
      channel.nack(msg, false, false)
      return
    }

    const { id: id_profile, name } = payload

    try {
      await profileRepository.upsert(createProfile({ id_profile, name }))
      logger.info({ id_profile, routingKey: msg.fields.routingKey }, 'Profile upserted')
      channel.ack(msg)
    } catch (err) {
      logger.error({ err, id_profile }, 'Failed to process profile event')
      channel.nack(msg, false, false)
    }
  })

  logger.info({ queue: QUEUE, bindingKey: BINDING_KEY }, 'RabbitMQ subscriber registered')
}

/**
 * @param {import('amqplib').Channel} channel
 * @param {import('../../../adapters/outbound/cache/user-state-repository.js').UserStateRepository} userStateRepository
 * @param {import('../../../adapters/outbound/db/match-repository.js').MatchRepository} matchRepository
 * @param {import('../../../domain/ports/outbound/event-publisher.js').IEventPublisher} eventPublisher
 */
export async function registerSwipeSubscriber(channel, userStateRepository, matchRepository, eventPublisher) {
  const SWIPE_EXCHANGE = env.RABBITMQ_SWIPE_EXCHANGE
  const SWIPE_QUEUE = env.RABBITMQ_SWIPE_QUEUE
  const SWIPE_DLQ = `${SWIPE_QUEUE}.dlq`
  const SWIPE_BINDING_KEY = env.RABBITMQ_SWIPE_BINDING_KEY

  await channel.assertExchange(SWIPE_EXCHANGE, 'topic', { durable: true })
  await channel.assertExchange(SWIPE_DLQ, 'topic', { durable: true })
  await channel.assertQueue(SWIPE_QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': SWIPE_DLQ,
    },
  })
  await channel.bindQueue(SWIPE_QUEUE, SWIPE_EXCHANGE, SWIPE_BINDING_KEY)

  channel.consume(SWIPE_QUEUE, async (msg) => {
    if (!msg) return

    let payload
    try {
      payload = JSON.parse(msg.content.toString())
    } catch (err) {
      logger.error({ err }, 'Failed to parse swipe message')
      channel.nack(msg, false, false)
      return
    }

    const routingKey = msg.fields.routingKey
    const { requesterId, targetId, liked } = payload

    try {
      if (routingKey === 'match.swipe.created') {
        await userStateRepository.addSeen(requesterId, targetId)

        const mutualLike = liked && await userStateRepository.hasLiked(targetId, requesterId)

        if (liked && !mutualLike) {
          await userStateRepository.addLiked(requesterId, targetId)
        }

        if (mutualLike) {
          const createMatch = new CreateMatchUseCase(matchRepository, eventPublisher)
          await createMatch.execute({ id_profile1: requesterId, id_profile2: targetId })

          await userStateRepository.removeSuggestion(requesterId, targetId)
          await userStateRepository.removeSuggestion(targetId, requesterId)
          await userStateRepository.addSeen(targetId, requesterId)
          await userStateRepository.removeLiked(targetId, requesterId)

          logger.info({ requesterId, targetId }, 'Mutual like — match created')
        }
      } else {
        logger.warn({ routingKey }, 'Unknown swipe routing key, skipping')
      }

      channel.ack(msg)
    } catch (err) {
      logger.error({ err, requesterId, targetId, routingKey }, 'Failed to process swipe event')
      channel.nack(msg, false, false)
    }
  })

  logger.info({ queue: SWIPE_QUEUE, bindingKey: SWIPE_BINDING_KEY }, 'Swipe subscriber registered')
}

/**
 * @param {import('amqplib').Channel} channel
 * @param {import('../../../adapters/outbound/cache/user-state-repository.js').UserStateRepository} userStateRepository
 */
export async function registerSuggestionsSubscriber(channel, userStateRepository) {
  const SUGGESTION_EXCHANGE = env.RABBITMQ_SUGGESTION_EXCHANGE
  const SUGGESTION_QUEUE = env.RABBITMQ_SUGGESTION_QUEUE
  const SUGGESTION_DLQ = `${SUGGESTION_QUEUE}.dlq`
  const SUGGESTION_BINDING_KEY = env.RABBITMQ_SUGGESTION_BINDING_KEY

  await channel.assertExchange(SUGGESTION_EXCHANGE, 'topic', { durable: true })
  await channel.assertExchange(SUGGESTION_DLQ, 'topic', { durable: true })
  await channel.assertQueue(SUGGESTION_QUEUE, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': SUGGESTION_DLQ },
  })
  await channel.bindQueue(SUGGESTION_QUEUE, SUGGESTION_EXCHANGE, SUGGESTION_BINDING_KEY)

  channel.consume(SUGGESTION_QUEUE, async (msg) => {
    if (!msg) return

    let payload
    try {
      payload = JSON.parse(msg.content.toString())
    } catch (err) {
      logger.error({ err }, 'Failed to parse suggestion message')
      channel.nack(msg, false, false)
      return
    }

    const { profileId, suggestions } = payload

    try {
      if (!profileId || !Array.isArray(suggestions)) {
        logger.warn({ payload }, 'Invalid suggestion message shape, skipping')
        channel.nack(msg, false, false)
        return
      }

      await userStateRepository.addSuggestionsExcludingSeen(profileId, suggestions)
      logger.info({ profileId, count: suggestions.length }, 'Suggestions processed')
      channel.ack(msg)
    } catch (err) {
      logger.error({ err, profileId }, 'Failed to process suggestion event')
      channel.nack(msg, false, false)
    }
  })

  logger.info({ queue: SUGGESTION_QUEUE, bindingKey: SUGGESTION_BINDING_KEY }, 'Suggestion subscriber registered')
}
