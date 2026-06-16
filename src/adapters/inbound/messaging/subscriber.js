import { logger } from '../../../shared/logger.js'

const EXCHANGE = 'profile'
const QUEUE = 'match-service.profile.profile.created'
const DLQ = 'match-service.profile.profile.created.dlq'
const BINDING_KEY = 'profile.profile.created'

/**
 * @param {import('amqplib').Channel} channel
 * @param {import('../../../domain/use-cases/create-profile.js').CreateProfileUseCase} createProfileUseCase
 */
export async function registerSubscribers(channel, createProfileUseCase) {
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

    const { id_profile, name } = payload
    try {
      await createProfileUseCase.execute({ id_profile, name })
      channel.ack(msg)
    } catch (err) {
      logger.error({ err, id_profile }, 'Failed to process profile.profile.created event')
      channel.nack(msg, false, false)
    }
  })

  logger.info({ queue: QUEUE }, 'RabbitMQ subscriber registered')
}
