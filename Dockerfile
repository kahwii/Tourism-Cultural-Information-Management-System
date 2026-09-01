# ============================================================
#  TCIMS backend — PHP 8.2 + Apache, for Render (Docker web service)
#
#  Build context is the repository root, so that my-app-backend/ can be
#  copied to /var/www/html/my-app-backend and every existing URL keeps
#  working unchanged:
#     https://<service>.onrender.com/my-app-backend/api/feedback.php
# ============================================================
FROM php:8.2-apache

# ------------------------------------------------------------
# System packages
#   ca-certificates: REQUIRED. firebase_login.php fetches Google's public
#   signing keys over HTTPS to verify ID tokens. Without a CA bundle that
#   call fails, and Google sign-in breaks on BOTH the mobile app and the
#   website. The same bundle is used for the TLS connection to TiDB Cloud.
# ------------------------------------------------------------
#   libjpeg/libpng/libwebp/libfreetype/libavif: needed to build the GD
#   extension below. Without GD, every image upload endpoint (event posters,
#   avatars) fails outright — getimagesize() still works without it, but
#   none of the imagecreatefrom*()/imagejpeg() calls used to re-encode and
#   resize uploads exist, so the upload always 500s.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
       libjpeg62-turbo-dev libpng-dev libwebp-dev libfreetype6-dev libavif-dev \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# mysqli for the database layer
RUN docker-php-ext-install mysqli && docker-php-ext-enable mysqli

# GD for image upload processing (event posters, avatars) — re-encodes and
# resizes uploads server-side, which also strips any hidden payload from a
# file that isn't really an image.
RUN docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype --with-avif \
    && docker-php-ext-install gd && docker-php-ext-enable gd

# .htaccess files in the project rely on mod_rewrite and mod_headers
RUN a2enmod rewrite headers

# Allow the .htaccess files that ship with the app to take effect.
# Deliberately NOT "Options Indexes" — that would let anyone browse
# /uploads/ (check-in selfies, accreditation docs, avatars) as a directory
# listing just by visiting the folder URL with no filename. FollowSymLinks
# only, so .htaccess still works but nothing is browsable that isn't linked.
RUN printf '<Directory /var/www/html>\n\
    Options FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>\n' > /etc/apache2/conf-available/tcims.conf \
    && a2enconf tcims

# Reasonable upload limits — accreditation documents and check-in photos
RUN printf 'upload_max_filesize = 8M\npost_max_size = 10M\nmemory_limit = 256M\n' \
    > /usr/local/etc/php/conf.d/tcims.ini

# ------------------------------------------------------------
# Application
# ------------------------------------------------------------
COPY my-app-backend/ /var/www/html/my-app-backend/

# uploads/ must exist and be writable. NOTE: Render's free tier has an
# ephemeral filesystem — anything written here is lost on restart/redeploy.
# Files must be stored externally (or as base64 in the database) for anything
# that has to survive; see RENDER_DEPLOYMENT_FOR_EMMAN.md section 6.
#
# mkdir -p with brace expansion ({a,b,c}) needs bash — Docker's default RUN
# shell is /bin/sh (dash), which does NOT expand braces, so that pattern
# silently created one literally-named folder instead of four subfolders.
# Listing each path explicitly works under any POSIX shell.
RUN mkdir -p /var/www/html/my-app-backend/uploads/visits \
             /var/www/html/my-app-backend/uploads/certificates \
             /var/www/html/my-app-backend/uploads/events \
             /var/www/html/my-app-backend/uploads/avatars \
    && chown -R www-data:www-data /var/www/html/my-app-backend/uploads

# ------------------------------------------------------------
# Port
#   Render injects the port to listen on via $PORT and fails the deploy if
#   the container listens anywhere else. Apache's port is baked into config
#   files at build time, so it is rewritten at START time instead.
# ------------------------------------------------------------
RUN printf '#!/bin/sh\n\
set -e\n\
PORT="${PORT:-80}"\n\
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf\n\
sed -i "s/<VirtualHost \\*:[0-9]*>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf\n\
echo "ServerName localhost" > /etc/apache2/conf-available/servername.conf\n\
a2enconf servername >/dev/null 2>&1 || true\n\
exec apache2-foreground\n' > /usr/local/bin/start.sh \
    && chmod +x /usr/local/bin/start.sh

EXPOSE 80
CMD ["/usr/local/bin/start.sh"]
