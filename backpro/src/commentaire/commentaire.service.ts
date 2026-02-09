// src/commentaire/commentaire.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commentaire } from './entities/commentaire.entity';
import { CreateCommentaireDto } from './dto/create-commentaire.dto';
import { UpdateCommentaireDto } from './dto/update-commentaire.dto';

@Injectable()
export class CommentaireService {
  constructor(
    @InjectRepository(Commentaire)
    private commentaireRepository: Repository<Commentaire>,
  ) {}

  async create(createCommentaireDto: CreateCommentaireDto): Promise<Commentaire> {
    const commentaire = this.commentaireRepository.create(createCommentaireDto);
    return await this.commentaireRepository.save(commentaire);
  }

  async findAll(): Promise<Commentaire[]> {
    return await this.commentaireRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: number): Promise<Commentaire> {
    const commentaire = await this.commentaireRepository.findOne({ where: { id } });
    
    if (!commentaire) {
      throw new NotFoundException(`Commentaire avec l'ID ${id} non trouvé`);
    }
    
    return commentaire;
  }

  async update(id: number, updateCommentaireDto: UpdateCommentaireDto): Promise<Commentaire> {
    const commentaire = await this.findOne(id);
    
    commentaire.commentaire = updateCommentaireDto.commentaire;
    commentaire.updatedAt = new Date();
    
    return await this.commentaireRepository.save(commentaire);
  }

  async remove(id: number): Promise<void> {
    const result = await this.commentaireRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Commentaire avec l'ID ${id} non trouvé`);
    }
  }
}