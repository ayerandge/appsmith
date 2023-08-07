#!/bin/bash

set -o nounset

CUSTOM_DOMAIN="${1-}"

# Check exist certificate with given custom domain
# Heroku not support for custom domain, only generate HTTP config if deploying on Heroku
use_https=false
if [[ -n $CUSTOM_DOMAIN ]] && [[ -z ${DYNO-} ]]; then
  use_https=true
  if ! [[ -e "/etc/letsencrypt/live/$CUSTOM_DOMAIN" ]]; then
    source "/opt/appsmith/init_ssl_cert.sh"
    if ! init_ssl_cert "$CUSTOM_DOMAIN"; then
      echo "Status code from init_ssl_cert is $?"
      use_https=false
    fi
  fi

elif [[ -z $CUSTOM_DOMAIN ]]; then
  CUSTOM_DOMAIN=_

fi

if $use_https; then
  # By default, container will use the auto-generate certificate by Let's Encrypt
  SSL_CERT_PATH="/etc/letsencrypt/live/$CUSTOM_DOMAIN/fullchain.pem"
  SSL_KEY_PATH="/etc/letsencrypt/live/$CUSTOM_DOMAIN/privkey.pem"

  # In case of existing custom certificate, container will use them to configure SSL
  if [[ -e "/appsmith-stacks/ssl/fullchain.pem" ]] && [[ -e "/appsmith-stacks/ssl/privkey.pem" ]]; then
    SSL_CERT_PATH="/appsmith-stacks/ssl/fullchain.pem"
    SSL_KEY_PATH="/appsmith-stacks/ssl/privkey.pem"
  fi
fi

cat <<EOF
map \$http_x_forwarded_proto \$origin_scheme {
  default \$http_x_forwarded_proto;
  '' \$scheme;
}

map \$http_x_forwarded_host \$origin_host {
  default \$http_x_forwarded_host;
  '' \$host;
}

map \$http_forwarded \$final_forwarded {
  default '\$http_forwarded, host=\$host;proto=\$scheme';
  '' '';
}

# Redirect logs to stdout/stderr for supervisor to capture them.
access_log /dev/stdout;

server_tokens off;

server {

$(
if $use_https; then
  echo "
  listen 80;
  server_name _;
  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl http2;
  ssl_certificate $SSL_CERT_PATH;
  ssl_certificate_key $SSL_KEY_PATH;
  include /appsmith-stacks/data/certificate/conf/options-ssl-nginx.conf;
  ssl_dhparam /appsmith-stacks/data/certificate/conf/ssl-dhparams.pem;
"
else
  echo "
  listen ${PORT:-80} default_server;
"
fi
)

  server_name _;

  client_max_body_size 150m;

  gzip on;
  gzip_types *;

  root /opt/appsmith/editor;
  index index.html;
  error_page 404 /;

  # https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors
  add_header Content-Security-Policy "frame-ancestors ${APPSMITH_ALLOWED_FRAME_ANCESTORS-'self' *}";

  location /.well-known/acme-challenge/ {
    root /appsmith-stacks/data/certificate/certbot;
  }

  location = /supervisor {
    return 301 /supervisor/;
  }

  location /supervisor/ {
    proxy_http_version       1.1;
    proxy_buffering          off;
    proxy_max_temp_file_size 0;
    proxy_redirect           off;

    proxy_set_header  Host              \$http_host/supervisor/;
    proxy_set_header  X-Forwarded-For   \$proxy_add_x_forwarded_for;
    proxy_set_header  X-Forwarded-Proto \$origin_scheme;
    proxy_set_header  X-Forwarded-Host  \$origin_host;
    proxy_set_header  Connection        "";

    proxy_pass http://localhost:9001/;

    auth_basic "Protected";
    auth_basic_user_file /etc/nginx/passwords;
  }

  proxy_set_header X-Forwarded-Proto \$origin_scheme;
  proxy_set_header X-Forwarded-Host \$origin_host;
  proxy_set_header Forwarded \$final_forwarded;

  location / {
    try_files /loading.html \$uri /index.html =404;
  }

  location ~ ^/static/(js|css|media)\b {
    # Files in these folders are hashed, so we can set a long cache time.
    add_header Cache-Control "max-age=31104000, immutable";  # 360 days
    access_log  off;
  }

  # If the path has an extension at the end, then respond with 404 status if the file not found.
  location ~ ^/(?!supervisor/).*\.[a-z]+$ {
    try_files \$uri =404;
  }

  location /api {
    proxy_read_timeout ${APPSMITH_SERVER_TIMEOUT:-60};
    proxy_send_timeout ${APPSMITH_SERVER_TIMEOUT:-60};
    proxy_pass http://localhost:8080;
  }

  location /oauth2 {
    proxy_pass http://localhost:8080;
  }

  location /login {
    proxy_pass http://localhost:8080;
  }

  location /rts {
    proxy_pass http://localhost:${APPSMITH_RTS_PORT:-8091};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Upgrade \$http_upgrade;
  }
}
EOF
