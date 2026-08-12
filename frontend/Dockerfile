FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# Expose host for Vite to be accessible from outside container
CMD ["npm", "run", "dev", "--", "--host"]
