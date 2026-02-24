# Etapa 1: Construcción
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG _GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$_GEMINI_API_KEY
RUN npm run build

# Etapa 2: Servidor de producción
FROM nginx:stable-alpine

# Eliminamos la configuración por defecto de Nginx para evitar conflictos
RUN rm /etc/nginx/conf.d/default.conf

# Creamos nuestra propia configuración para que escuche en el 8080
RUN echo 'server { \
    listen 8080; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

# Exponemos el 8080, que es el estándar de Cloud Run
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]