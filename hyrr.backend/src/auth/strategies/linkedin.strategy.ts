import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';
import { AuthService } from '../auth.service';

@Injectable()
export class LinkedinStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.LINKEDIN_CLIENT_ID || 'linkedin_client_id',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || 'linkedin_client_secret',
      callbackURL: process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:3000/api/auth/linkedin/callback',
      scope: ['r_emailaddress', 'r_liteprofile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return this.authService.upsertOAuthUser({
      provider: 'linkedin',
      id: profile.id,
      email: profile.emails?.[0]?.value || '',
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value || '',
    });
  }
}
