import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { prisma } from "./prisma";
import { sendWelcomeEmail } from "./email";

const useSecureCookies = process.env.AUTH_URL?.startsWith("https://") ?? false;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
      checks: ["state"],
    }),
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: "noreply@projection.finance",
    }),
  ],
  cookies: {
    pkceCodeVerifier: {
      name: useSecureCookies ? "__Secure-authjs.pkce.code_verifier" : "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 min
      },
    },
  },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/link-sent",
  },
  session: { strategy: "database" },
  events: {
    async createUser({ user }) {
      if (user.email) {
        sendWelcomeEmail(user.email, user.name).catch(console.error);
      }
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user.id) {
        session.user.id = user.id;
        // Open-source & free: everyone has full access.
        session.user.plan = "pro";
      }
      return session;
    },
  },
});
