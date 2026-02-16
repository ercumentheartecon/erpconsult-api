import { env } from "../../config/env";

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomMeetingResponse {
  id: number;
  join_url: string;
  password: string;
  topic: string;
  start_url: string;
}

interface ZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  password: string;
}

// Cache token to avoid repeated requests
let cachedToken: { token: string; expiresAt: number } | null = null;

export class ZoomService {
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
      return cachedToken.token;
    }

    const credentials = Buffer.from(
      `${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "account_credentials",
        account_id: env.ZOOM_ACCOUNT_ID,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Zoom OAuth error:", response.status, errText);
      throw new Error(`Failed to get Zoom access token: ${response.status}`);
    }

    const data = (await response.json()) as ZoomTokenResponse;
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
  }

  async createMeeting(topic: string, durationMinutes: number = 60): Promise<ZoomMeetingResult> {
    const token = await this.getAccessToken();

    const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
        type: 1, // Instant meeting
        duration: durationMinutes,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          waiting_room: false,
          audio: "both",
          auto_recording: "none",
          mute_upon_entry: false,
          approval_type: 0, // Automatically approve
          meeting_authentication: false,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Zoom create meeting error:", response.status, errText);
      throw new Error(`Failed to create Zoom meeting: ${response.status}`);
    }

    const data = (await response.json()) as ZoomMeetingResponse;

    return {
      meetingId: String(data.id),
      joinUrl: data.join_url,
      password: data.password,
    };
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      const token = await this.getAccessToken();

      await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error("Failed to delete Zoom meeting:", err);
      // Non-critical, don't throw
    }
  }
}
