import { IsNotEmpty, IsString } from "class-validator";

export class TapCkbParams {
  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;
}
