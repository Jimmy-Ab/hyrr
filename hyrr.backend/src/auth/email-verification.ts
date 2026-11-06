import { HttpStatus } from "@nestjs/common"
import { AppException } from "../core/exceptions/app-exception"

export class EmailNotVerifiedException extends AppException {
  constructor() {
    super(
      "Please verify your e-mail address first. Check your inbox or resend the verification e-mail.",
      HttpStatus.FORBIDDEN,
      "EMAIL_NOT_VERIFIED"
    )
  }
}

/** Throws 403 EMAIL_NOT_VERIFIED unless the user has confirmed their e-mail address. */
export function requireVerifiedEmail(user: { emailVerifiedAt: Date | null }): void {
  if (!user?.emailVerifiedAt) throw new EmailNotVerifiedException()
}

type VerificationLookup = {
  user: {
    findUnique(args: {
      where: { id: string }
      select: { emailVerifiedAt: true }
    }): Promise<{ emailVerifiedAt: Date | null } | null>
  }
}

/** Loads the user and throws 403 EMAIL_NOT_VERIFIED unless their e-mail is verified. */
export async function assertEmailVerified(
  prisma: VerificationLookup,
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  })
  requireVerifiedEmail(user ?? { emailVerifiedAt: null })
}
