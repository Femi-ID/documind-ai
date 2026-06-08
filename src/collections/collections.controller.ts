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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Collections')
@ApiBearerAuth('access-token')
@Controller({ version: '1', path: 'collections' })
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @ApiOperation({ summary: 'Create a new document collection' })
  @ApiResponse({ status: 201, description: 'Collection created' })
  @ApiResponse({
    status: 409,
    description: 'Collection name already exists for this user',
  })
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

  @ApiOperation({
    summary:
      'List all collections, or get a single collection with its conversations',
  })
  @ApiQuery({
    name: 'collectionId',
    required: false,
    description: 'Get a specific collection by ID',
  })
  @ApiResponse({ status: 200, description: 'Returns collections' })
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

  @ApiOperation({ summary: 'Update a collection name or description' })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    format: 'uuid',
  })
  @ApiResponse({ status: 200, description: 'Collection updated' })
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

  @ApiOperation({
    summary: 'Delete a collection and all its documents with chunks',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Collection and associated documents deleted',
  })
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
