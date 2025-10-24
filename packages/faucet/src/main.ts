import { loadConfig } from "@app/commons";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NextFunction, Response } from "express";
import { AppModule } from "./app.module";

function handleRoot(req: Request, res: Response, next: NextFunction) {
  if (req.url === "/") {
    return res.send("OK!");
  }

  next();
}

async function bootstrap() {
  const config = loadConfig();

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.use(handleRoot);
  app.enableCors({
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  });

  await app.listen(config.port as string | number, () =>
    Logger.log(`listening on ${config.port}`),
  );
}

void bootstrap();
