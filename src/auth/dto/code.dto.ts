import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CodeDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]*$/, { message: 'Invalid Code' })
  code: string;
}
