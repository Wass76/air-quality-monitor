import { Module } from '@nestjs/common';
import { ThresholdEvaluator } from './threshold.evaluator';

@Module({
  providers: [ThresholdEvaluator],
  exports: [ThresholdEvaluator],
})
export class ThresholdModule {}
