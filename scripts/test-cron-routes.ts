#!/usr/bin/env ts-node

/**
 * Script de test pour les routes de cron
 * 
 * Usage:
 *   npm run test:cron
 *   
 * Ou directement:
 *   CRON_SECRET=your-secret ts-node scripts/test-cron-routes.ts
 * 
 * Ce script teste toutes les routes de cron pour s'assurer qu'elles fonctionnent correctement.
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface CronRoute {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  authType: 'bearer' | 'header'; // bearer = Authorization: Bearer {token}, header = x-cron-secret
}

const CRON_ROUTES: CronRoute[] = [
  {
    name: 'Cleanup Logs',
    path: '/api/cron/cleanup-logs',
    method: 'POST',
    authType: 'bearer',
  },
  {
    name: 'Process Payouts',
    path: '/api/cron/process-payouts',
    method: 'GET',
    authType: 'header',
  },
  {
    name: 'Process Automatic Payouts',
    path: '/api/cron/process-automatic-payouts',
    method: 'GET',
    authType: 'bearer',
  },
];

async function testCronRoute(route: CronRoute): Promise<void> {
  console.log(`\n🧪 Testing: ${route.name}`);
  console.log(`   Path: ${route.method} ${route.path}`);
  console.log(`   Auth: ${route.authType}`);

  if (!CRON_SECRET) {
    console.error('   ❌ CRON_SECRET not configured in environment');
    return;
  }

  const url = `${BASE_URL}${route.path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authentication header based on route's auth type
  if (route.authType === 'bearer') {
    headers['Authorization'] = `Bearer ${CRON_SECRET}`;
  } else if (route.authType === 'header') {
    headers['x-cron-secret'] = CRON_SECRET;
  }

  try {
    console.log(`   🔄 Sending request to ${url}...`);
    
    const response = await fetch(url, {
      method: route.method,
      headers,
    });

    console.log(`   📡 Response status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ Success!`);
      console.log(`   📊 Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`   ❌ Failed!`);
      console.log(`   📊 Error:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
  }
}

async function testUnauthorizedAccess(route: CronRoute): Promise<void> {
  console.log(`\n🔒 Testing unauthorized access: ${route.name}`);

  const url = `${BASE_URL}${route.path}`;
  
  try {
    const response = await fetch(url, {
      method: route.method,
      headers: {
        'Content-Type': 'application/json',
        // Intentionally sending wrong or no auth header
        ...(route.authType === 'bearer' ? { 'Authorization': 'Bearer wrong-token' } : {}),
        ...(route.authType === 'header' ? { 'x-cron-secret': 'wrong-token' } : {}),
      },
    });

    if (response.status === 401) {
      console.log(`   ✅ Correctly rejected unauthorized request (401)`);
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status} (expected 401)`);
    }
  } catch (error) {
    console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('🚀 Starting Cron Route Tests');
  console.log('=' .repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`CRON_SECRET configured: ${CRON_SECRET ? '✅ Yes' : '❌ No'}`);
  console.log('=' .repeat(50));

  if (!CRON_SECRET) {
    console.error('\n❌ CRON_SECRET not found in environment variables!');
    console.error('Please set CRON_SECRET in your .env.local file\n');
    process.exit(1);
  }

  // Test each cron route with valid authentication
  console.log('\n📋 Testing Valid Authentication');
  console.log('-' .repeat(50));
  for (const route of CRON_ROUTES) {
    await testCronRoute(route);
  }

  // Test unauthorized access
  console.log('\n\n📋 Testing Unauthorized Access');
  console.log('-' .repeat(50));
  for (const route of CRON_ROUTES) {
    await testUnauthorizedAccess(route);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ All tests completed!');
  console.log('=' .repeat(50));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
