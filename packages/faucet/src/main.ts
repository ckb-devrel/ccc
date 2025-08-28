import { loadConfig } from "@app/commons";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// eslint-disable-next-line @typescript-eslint/require-await
async function handleRoot(req: any, res: any, next: any) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (req.url === "/") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return res.send("OK!");
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
