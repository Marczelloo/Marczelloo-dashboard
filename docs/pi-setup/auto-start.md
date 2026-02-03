# Pi Auto-Start & Restart Configuration

This document explains how to configure the Raspberry Pi to automatically start all services after boot and restart every 7 days.

## 1. Systemd Service: Docker Compose Projects

Create a systemd service file that starts all Docker Compose projects:

```bash
sudo nano /etc/systemd/system/docker-projects.service
```

Content:

```ini
[Unit]
Description=Start all Docker Compose projects
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=Marczelloo_pi
WorkingDirectory=/home/Marczelloo_pi/projects
ExecStart=/bin/bash -c 'for dir in */; do if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/compose.yaml" ]; then cd "$dir" && docker compose up -d && cd ..; fi; done'
ExecStop=/bin/bash -c 'for dir in */; do if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/compose.yaml" ]; then cd "$dir" && docker compose down && cd ..; fi; done'

[Install]
WantedBy=multi-user.target
```

Enable the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable docker-projects.service
```

## 2. Cloudflare Tunnel Service

If using cloudflared, ensure it's set up as a systemd service:

```bash
# Install cloudflared if not already
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/

# Create the service
sudo cloudflared service install

# Enable it
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Or create a custom service:

```bash
sudo nano /etc/systemd/system/cloudflared.service
```

Content:

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target docker-projects.service

[Service]
Type=simple
User=Marczelloo_pi
ExecStart=/usr/local/bin/cloudflared tunnel run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
```

## 3. Weekly Restart Cron

Add a cron job to restart the Pi every 7 days (Sunday 3am):

```bash
sudo crontab -e
```

Add:

```cron
# Restart Pi every Sunday at 3:00 AM
0 3 * * 0 /sbin/shutdown -r now
```

Or for exactly every 7 days:

```cron
# Restart every 7 days at 3:00 AM
0 3 */7 * * /sbin/shutdown -r now
```

## 4. Verify Setup

Check services are enabled:

```bash
systemctl is-enabled docker-projects
systemctl is-enabled cloudflared
```

Check cron jobs:

```bash
sudo crontab -l
```

## 5. Dashboard Integration

The dashboard includes a "Restart Pi" button that calls the runner's `/shell` endpoint with a reboot command. This requires proper sudo permissions:

```bash
# Allow Marczelloo_pi to reboot without password
sudo visudo
```

Add:

```text
Marczelloo_pi ALL=(ALL) NOPASSWD: /sbin/shutdown, /sbin/reboot
```

## Troubleshooting

View service logs:

```bash
journalctl -u docker-projects -f
journalctl -u cloudflared -f
```

Check Docker containers:

```bash
docker ps -a
```
