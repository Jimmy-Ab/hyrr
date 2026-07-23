import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'hyrr_dev_secret',
    });
  }

  async validate(payload: { sub: string; role: string; email: string; companyId?: string | null }) {
    return { userId: payload.sub, role: payload.role, email: payload.email, companyId: payload.companyId || null };
  }
}
