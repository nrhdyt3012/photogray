FROM node:20-alpine AS build
RUN npm i -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Variabel VITE_* ikut tertanam saat build, jadi harus diberikan sebagai build arg
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_CLOUDINARY_CLOUD_NAME
ARG VITE_CLOUDINARY_UPLOAD_PRESET
ARG VITE_BASE_URL
RUN pnpm build

FROM node:20-alpine
RUN npm i -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/build ./build
# Runtime (jangan di-bake): SUPABASE_SERVICE_ROLE_KEY dan SUPABASE_URL
CMD ["pnpm", "start"]
