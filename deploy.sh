#!/bin/bash
set -euo pipefail

# projektor.one deploy script
# Usage: ./deploy.sh [--build-only]
#
# Builds a clean static bundle and deploys it to Cloudflare Pages.

BUILD_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --build-only)
            BUILD_ONLY=true
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/dist"
PROJECT_NAME="projektor-one"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   projektor.one Deploy Script          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}[1/2]${NC} Building static bundle..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cp "$SCRIPT_DIR/index.html" "$BUILD_DIR/index.html"
cp "$SCRIPT_DIR/styles.css" "$BUILD_DIR/styles.css"
cp "$SCRIPT_DIR/app.js" "$BUILD_DIR/app.js"

if [ -d "$SCRIPT_DIR/docs" ]; then
    cp -R "$SCRIPT_DIR/docs" "$BUILD_DIR/docs"
fi

cp "$BUILD_DIR/index.html" "$BUILD_DIR/404.html"
printf '/* /index.html 200\n' > "$BUILD_DIR/_redirects"

if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo -e "${RED}✗ Build verification failed: index.html not found${NC}"
    exit 1
fi

if [ ! -f "$BUILD_DIR/styles.css" ]; then
    echo -e "${RED}✗ Build verification failed: styles.css not found${NC}"
    exit 1
fi

if [ ! -f "$BUILD_DIR/app.js" ]; then
    echo -e "${RED}✗ Build verification failed: app.js not found${NC}"
    exit 1
fi

if [ ! -f "$BUILD_DIR/404.html" ]; then
    echo -e "${RED}✗ Build verification failed: 404.html not found${NC}"
    exit 1
fi

if [ ! -f "$BUILD_DIR/_redirects" ]; then
    echo -e "${RED}✗ Build verification failed: _redirects not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Static bundle ready${NC}"
echo ""

if [ "$BUILD_ONLY" = true ]; then
    echo -e "${GREEN}✓ Build complete (--build-only)${NC}"
    echo -e "${BLUE}📁 Output:${NC} $BUILD_DIR"
    exit 0
fi

echo -e "${BLUE}[2/2]${NC} Deploying to Cloudflare Pages..."
if command -v npx >/dev/null 2>&1; then
    if (cd "$SCRIPT_DIR" && npx wrangler pages deploy dist --project-name="$PROJECT_NAME" --branch=main --commit-dirty=true); then
        echo -e "${GREEN}✓ Deployed to Cloudflare Pages${NC}"
    else
        echo -e "${RED}✗ Cloudflare deployment failed${NC}"
        echo -e "${YELLOW}  Make sure you're logged in: npx wrangler login${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ npx not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✓ Deploy Completed!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📁 Build output:${NC} $BUILD_DIR"
echo -e "${BLUE}☁️  Live at:${NC} https://projektor-one.pages.dev"
echo ""
