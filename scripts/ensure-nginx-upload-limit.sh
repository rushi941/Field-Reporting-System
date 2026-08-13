#!/bin/bash
# Nginx defaults to 1m request bodies, which turns ~1 MB files (plus multipart
# overhead) into a browser "Failed to fetch". Allow field attachments (5 MB).
set -euo pipefail

sudo tee /etc/nginx/conf.d/frs-client-max-body.conf >/dev/null <<'EOF'
# Field report attachments: 5 MB file + multipart overhead
client_max_body_size 10m;
EOF

for site in /etc/nginx/sites-enabled/frs /etc/nginx/sites-enabled/advance; do
  if [ -f "$site" ] && ! grep -q "client_max_body_size" "$site"; then
    sudo sed -i '/location \/ {/i\    client_max_body_size 10m;\n    proxy_read_timeout 120s;\n    proxy_send_timeout 120s;' "$site"
  fi
done

sudo nginx -t
sudo systemctl reload nginx
echo "nginx client_max_body_size set to 10m"
