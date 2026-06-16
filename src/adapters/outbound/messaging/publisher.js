import { logger } from '../../../shared/logger.js';

const EXCHANGE = 'match';

export class RabbitMQEventPublisher {
  /** @type {import('amqplib').Channel} */
  #channel = null;

  /** @param {import('amqplib').Channel} channel */
  connect(channel) {
    this.#channel = channel;
  }

  /**
   * @param {string} routingKey
   * @param {object} payload
   */
  async publish(routingKey, payload) {
    try {
      await this.#channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      this.#channel.publish(
        EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
      );
    } catch (err) {
      logger.error({ err, routingKey }, 'Failed to publish event');
    }
  }
}
