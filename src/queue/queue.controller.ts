import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@ApiTags('System')
@Controller({ version: '1', path: 'queue' })
export class QueueController {}
