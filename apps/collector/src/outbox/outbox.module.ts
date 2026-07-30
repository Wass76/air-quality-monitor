import { Module } from '@nestjs/common';
import { AlertOutboxService } from './alert-outbox.service';
import { OutboxRelayService } from './outbox-relay.service';

@Module({
  providers: [AlertOutboxService, OutboxRelayService],
  exports: [AlertOutboxService, OutboxRelayService],
})
export class OutboxModule {}
