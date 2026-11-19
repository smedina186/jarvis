import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { authenticationReady, isOwnerAccount } from "@/lib/private-config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({
    clientId: process.env.AUTH_GITHUB_ID,
    clientSecret: process.env.AUTH_GITHUB_SECRET,
  })],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ account }) {
      return authenticationReady() && Boolean(account && isOwnerAccount(
        account.provider, account.providerAccountId,
      ));
    },
    jwt({ token, account }) {
      if (account) token.sub = account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      return session;
    },
    redirect({ url }) {
      const base = process.env.AUTH_URL;
      if (!base) return "/login";
      const target = new URL(url, base);
      return target.origin === new URL(base).origin ? target.href : base;
    },
  },
});
