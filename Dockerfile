FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_AUTH_URL
ARG VITE_SUPABASE_AUTH_PUBLISHABLE_KEY
ENV VITE_SUPABASE_AUTH_URL=$VITE_SUPABASE_AUTH_URL
ENV VITE_SUPABASE_AUTH_PUBLISHABLE_KEY=$VITE_SUPABASE_AUTH_PUBLISHABLE_KEY
RUN npm run build
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
