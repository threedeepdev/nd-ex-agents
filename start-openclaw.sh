#!/bin/bash
# Start/restart OpenClaw on the DigitalOcean droplet and print the tunnel URL

DROPLET="root@198.199.83.91"

echo "Restarting OpenClaw service..."
ssh $DROPLET "systemctl restart openclaw.service"

echo "Checking status..."
ssh $DROPLET "systemctl is-active openclaw.service"

echo "Checking cloudflared tunnel..."
TUNNEL_URL=$(ssh $DROPLET "journalctl -u openclaw.service -n 50 --no-pager 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1")

if [ -z "$TUNNEL_URL" ]; then
  # Try checking the cloudflared process directly
  TUNNEL_URL=$(ssh $DROPLET "ps aux | grep cloudflared | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1")
fi

echo ""
echo "OpenClaw is running at: http://localhost:18789 (on droplet)"
echo "Agents UI: http://localhost:18789/agents"
echo ""

if [ -n "$TUNNEL_URL" ]; then
  echo "Public tunnel URL: $TUNNEL_URL"
  echo ""
  echo "Update OPENCLAW_GATEWAY_URL in Vercel if this changed:"
  echo "  $TUNNEL_URL"
else
  echo "Could not detect tunnel URL. Check manually:"
  echo "  ssh $DROPLET 'ps aux | grep cloudflared'"
fi
