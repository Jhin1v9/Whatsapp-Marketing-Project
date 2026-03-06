import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true, rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const portRaw = process.env.PORT?.trim();
  const port = portRaw && /^\d+$/.test(portRaw) ? Number(portRaw) : 3001;

  await app.listen(port);
}

void bootstrap();
