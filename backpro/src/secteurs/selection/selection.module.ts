import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Selection } from './selection.entity';
import { SelectionService } from './selection.service';
import { SelectionController } from './selection.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Selection])],
  controllers: [SelectionController],
  providers: [SelectionService],
})
export class SelectionModule {}