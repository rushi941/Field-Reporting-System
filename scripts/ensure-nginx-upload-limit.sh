#!/bin/bash
# Nginx defaults to 1m request bodies, which turns 2–3 MB uploads into a
# browser "Failed to fetch". Allow field attachments (5 MB) plus form overhead.
set -euo pipefail

sudo tee /etc/nginx/conf.d/frs-client-max-body.conf >/dev/null <<'EOF'
# Field report attachments: 5 MB file + multipart overhead
client_max_body_size 10m;
EOF

sudo nginx -t
sudo systemctl reload nginx
echo "nginx client_max_body_size set to 10m"
