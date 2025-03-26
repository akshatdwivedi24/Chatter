# Chatter - Real-time Chat Application

A modern real-time chat application built with Spring Boot and React.

## Features

- Real-time messaging using WebSocket
- User authentication
- Modern and responsive UI
- Message history
- H2 database for data persistence

## Prerequisites

- Java 17 or later
- Node.js 14 or later
- Maven
- npm or yarn

## Backend Setup

1. Navigate to the root directory
2. Run the Spring Boot application:
   ```bash
   mvn spring-boot:run
   ```
3. The backend will start on `http://localhost:8080`

## Frontend Setup

1. Navigate to the FrontEnd directory:
   ```bash
   cd FrontEnd
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. The frontend will be available at `http://localhost:5173`

## Usage

1. Open your browser and navigate to `http://localhost:5173`
2. Enter a username to join the chat
3. Start sending messages!

## Technologies Used

### Backend
- Spring Boot
- Spring WebSocket
- Spring Data JPA
- H2 Database
- Lombok

### Frontend
- React
- Vite
- WebSocket API
- CSS3

## Database

The application uses H2 database. You can access the H2 console at `http://localhost:8080/h2-console` with the following credentials:
- JDBC URL: `jdbc:h2:file:./chatterdb`
- Username: `sa`
- Password: `password` 