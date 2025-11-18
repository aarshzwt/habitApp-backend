FROM node:22

WORKDIR /src

# Install dependencies first (for caching)
COPY package*.json ./
RUN npm install

# Install nodemon globally for live reload
RUN npm install -g nodemon

# Ensure file watching works inside Docker on all OS
ENV CHOKIDAR_USEPOLLING=true
ENV NODE_ENV=development

# Copy the source (optional for prod, but we'll override with volume anyway)
COPY . .

EXPOSE 5000

# Use nodemon to auto-reload on file changes
CMD ["npm", "run", "dev"]
