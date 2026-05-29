import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { CustomThrottlers } from '../constants/custom-throttlers.constant';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, throttler } = requestProps;

    const throttlerName = throttler.name;
    this.logger.debug(
      `handleRequest called for: ${throttlerName}`,
    );
    if (!throttlerName) {
      return super.handleRequest(requestProps);
    }

    // allow the 'DEFAULT' throttler to be applied globally
    if (throttlerName === CustomThrottlers.DEFAULT) {
      return super.handleRequest(requestProps);
    }

    // check if all other throttlers were explicitly invoked
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Keys are concatenated: 'THROTTLE:LIMIT' + 'MODERATE' = 'THROTTLER:LIMITmoderate'
    const hasCustomLimit = this.reflector.getAllAndOverride(
      'THROTTLER:LIMIT' + throttlerName,
      [handler, classRef],
    );

    // 'THROTTLER:SKIP' + 'moderate' = 'THROTTLER:SKIPmoderate'
    const explicitlyUnskipped =
      this.reflector.getAllAndOverride('THROTTLER:SKIP' + throttlerName, [
        handler,
        classRef,
      ]) === false;

    this.logger.debug(`[CustomThrottlerGuard] hasCustomLimit:`, hasCustomLimit);
    this.logger.debug(
      `[CustomThrottlerGuard] explicitlyUnskipped:`,
      explicitlyUnskipped,
    );

    // If it wasn't explicitly invoked on this route, bypass it by returning true
    if (!hasCustomLimit && !explicitlyUnskipped) {
      return true;
    }

    this.logger.debug(
      `[CustomThrottlerGuard] APPLYING rate limit for ${throttlerName}`,
    );
    return super.handleRequest(requestProps);
  }
}
