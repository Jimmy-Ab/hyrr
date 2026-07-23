import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // If JWT is present and valid, user is attached.
    // If JWT is missing or invalid, return null without throwing 401.
    return user || null;
  }
}
