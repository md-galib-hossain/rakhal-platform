export interface LoginInput {
  email: string;
  password: string;
  farmId: string;
}

export interface LogoutInput {
  sessionId?: string;
}

export interface RefreshTokenInput {
  farmId: string;
  refreshToken?: string;
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface RevokeSessionInput {
  sessionId: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
