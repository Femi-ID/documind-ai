import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import type { UserRequest } from 'src/auth/types/request.interface';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post('create')
  async createCollection(
    @Request() req: UserRequest,
    @Body() createCollectionDto: CreateCollectionDto,
  ) {
    return await this.collectionsService.createCollection(
      req.user.id,
      createCollectionDto,
    );
  }

  @Get()
  async getCollections(
    @Request() req: UserRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    return await this.collectionsService.getCollections(
      req.user.id,
      collectionId,
    );
  }

  @Put(':collectionId')
  async updateCollection(
    @Request() req: UserRequest,
    @Param('collectionId') collectionId: string,
    updateCollectionDto: UpdateCollectionDto,
  ) {
    return await this.collectionsService.updateCollection(
      req.user.id,
      collectionId,
      updateCollectionDto,
    );
  }

  @Delete(':collectionId')
  async deleteCollection(
    @Param('collectionId') collectionId: string,
    @Request() req: UserRequest,
  ) {
    return await this.collectionsService.deleteCollection(
      req.user.id,
      collectionId,
    );
  }
}
