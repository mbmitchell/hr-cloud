import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { resolveAuthenticatedEmployeeByEmail } from "./lib/auth/resolve-authenticated-employee";
import {
  authorizeMicrosoftEntraSignIn,
  getEmailFromAuthInput,
} from "./lib/auth/microsoft-entra-sso";

const allowDevAuth = process.env.AUTH_ENABLE_DEV_AUTH === "true";
const allowMicrosoftEntraAuth = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(allowMicrosoftEntraAuth
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          }),
        ]
      : []),
    ...(allowDevAuth
      ? [Credentials({
      name: "Development Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");

        if (!email || !password) return null;

        if (password !== process.env.AUTH_DEV_PASSWORD) return null;

        const employee = await resolveAuthenticatedEmployeeByEmail(email);

        if (!employee) return null;

        return {
          id: employee.id,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
        };
      },
    })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") {
        return true;
      }

      if (account?.provider !== "microsoft-entra-id") {
        return false;
      }

      const authenticatedUser = await authorizeMicrosoftEntraSignIn({
        user,
        profile: (profile as Record<string, unknown> | null) ?? null,
      });

      if (!authenticatedUser) {
        return false;
      }

      user.id = authenticatedUser.id;
      user.email = authenticatedUser.email;
      user.name = authenticatedUser.name;
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.employeeId = user.id;
        token.email = user.email;
        token.name = user.name;
      }

      if (
        account?.provider === "microsoft-entra-id" &&
        !token.employeeId
      ) {
        const email = getEmailFromAuthInput({
          user: {
            email:
              typeof token.email === "string" ? token.email : null,
          },
          profile: (profile as Record<string, unknown> | null) ?? null,
        });

        if (email) {
          const employee = await resolveAuthenticatedEmployeeByEmail(email);

          if (employee) {
            token.employeeId = employee.id;
            token.email = employee.email;
            token.name = `${employee.firstName} ${employee.lastName}`;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = String(token.email || session.user.email || "");
        session.user.name = String(token.name || session.user.name || "");
        session.user.employeeId = String(token.employeeId || "");
      }
      return session;
    },
  },
});
