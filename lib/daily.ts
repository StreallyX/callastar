const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

if (!DAILY_API_KEY) {
  console.warn('DAILY_API_KEY is not defined in environment variables');
}

interface CreateRoomOptions {
  name: string;
  properties?: {
    exp?: number; // Expiration time (Unix timestamp)
    enable_screenshare?: boolean;
    enable_chat?: boolean;
    max_participants?: number;
  };
}

interface CreateTokenOptions {
  roomName: string;
  userName: string;
  isOwner?: boolean;
  exp?: number; // Expiration time (Unix timestamp)
}

/**
 * Create a Daily.co room
 */
export async function createDailyRoom(
  options: CreateRoomOptions
): Promise<{ url: string; name: string }> {
  try {
    const response = await fetch(`${DAILY_API_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: options.name,
        privacy: 'private',
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          max_participants: 2,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours from now
          ...options.properties,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Daily API error: ${error?.error || response.statusText}`);
    }

    const data = await response.json();
    return {
      url: data.url,
      name: data.name,
    };
  } catch (error) {
    console.error('Error creating Daily room:', error);
    throw error;
  }
}

/**
 * Create a Daily.co meeting token
 */
export async function createMeetingToken(
  options: CreateTokenOptions
): Promise<string> {
  try {
    const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: options.roomName,
          user_name: options.userName,
          is_owner: options.isOwner || false,
          exp: options.exp || Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Daily API error: ${error?.error || response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error creating meeting token:', error);
    throw error;
  }
}

/**
 * Check if a Daily.co room exists
 */
export async function checkDailyRoomExists(roomName: string): Promise<boolean> {
  try {
    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
    });

    // If the response is 200 OK, the room exists
    if (response.ok) {
      return true;
    }

    // If the response is 404, the room doesn't exist
    if (response.status === 404) {
      return false;
    }

    // For other error codes, throw an error
    const error = await response.json();
    throw new Error(`Daily API error: ${error?.error || response.statusText}`);
  } catch (error) {
    // If it's a 404 error (room not found), return false
    if (error instanceof Error && error.message.includes('404')) {
      return false;
    }
    console.error('Error checking Daily room:', error);
    throw error;
  }
}

/**
 * Delete a Daily.co room
 */
export async function deleteDailyRoom(roomName: string): Promise<void> {
  try {
    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Daily API error: ${error?.error || response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting Daily room:', error);
    throw error;
  }
}
