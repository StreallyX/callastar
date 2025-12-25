import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '@/lib/db';
import { generateToken } from '@/lib/auth';

// Extend the built-in types
declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    role?: string;
  }
  
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role?: string;
    };
    customAuthToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    email?: string;
    role?: string;
    customAuthToken?: string;
  }
}

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
        token.role = user.role || 'USER';
        
        // Generate our custom JWT token for API authentication
        try {
          const customToken = await generateToken({
            userId: user.id,
            email: user.email!,
            role: user.role || 'USER'
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
        session.user.id = token.userId as string;
        session.user.email = token.email as string;
        session.user.role = token.role;
        session.customAuthToken = token.customAuthToken;
      }
      return session;
    },
  },
};
