import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '@/lib/db';
import { generateToken } from '@/lib/auth';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_PLACEHOLDER',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_PLACEHOLDER',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow Google SSO
      if (account?.provider === 'google') {
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // When user signs in for the first time
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.role = (user as any).role || 'USER';
        
        // Generate our custom JWT token for API authentication
        try {
          const customToken = await generateToken({
            userId: user.id,
            email: user.email!,
            role: (user as any).role || 'USER'
          });
          token.customAuthToken = customToken;
        } catch (error) {
          console.error('Error generating custom token:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.userId as string;
        session.user.email = token.email as string;
        (session.user as any).role = token.role;
        (session as any).customAuthToken = token.customAuthToken;
      }
      return session;
    },
  },
};
