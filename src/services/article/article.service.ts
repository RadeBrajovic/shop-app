import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@nestjsx/crud-typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Article } from "src/entities/article.entity";
import { AddArticleDto } from "src/dtos/article/add.article.dto";
import { ApiResponse } from "src/misc/api.response.class";
import { ArticlePrice } from "src/entities/article-price.entity";
import { ArticleFeature } from "src/entities/article-feature.entity";
import { EditArticleDto } from "src/dtos/article/edit.article.dto";

@Injectable()
export class ArticleService extends TypeOrmCrudService<Article> {
    constructor(
        @InjectRepository(Article) 
        private readonly article: Repository<Article>,

        @InjectRepository(ArticlePrice)
        private readonly articlePrice: Repository<ArticlePrice>,

        @InjectRepository(ArticleFeature)
        private readonly articleFeature: Repository<ArticleFeature>,

        ) {
            super(article);
        }

    async createFullArticle(data: AddArticleDto): Promise<Article | ApiResponse>{
        const newArticle: Article = new Article();
        newArticle.name        =  data.name;
        newArticle.categoryId  =  data.categoryId;
        newArticle.excerpt     =  data.excerpt;
        newArticle.description =  data.description;

        const savedArticle = await this.article.save(newArticle);

        const newArticlePrice: ArticlePrice = new ArticlePrice();
        newArticlePrice.articleId = savedArticle.articleId;
        newArticlePrice.price     = data.price;

        await this.articlePrice.save(newArticlePrice);

        for (const feature of data.features) {
            const newArticleFeature: ArticleFeature = new ArticleFeature();
            newArticleFeature.articleId = savedArticle.articleId;
            newArticleFeature.featureId = feature.featureId;
            newArticleFeature.value     = feature.value;

           await this.articleFeature.save(newArticleFeature);
        }

        return await this.article.findOne(savedArticle.articleId, {
            relations: [
                "category",
                "articleFeatures",
                "features",
                "articlePrices"
            ]
        });

    }

    async editFullArticle(articleId: number, data: EditArticleDto): Promise<Article | ApiResponse> {
        const existingArticle: Article = await this.article.findOne(articleId, {
            relations: ['articlePrices', 'articleFeatures']
        })

        if (!existingArticle) {
            return new ApiResponse('error', -5001, 'Article not found.');
        }

        existingArticle.name          = data.name;
        existingArticle.categoryId    = data.categoryId;
        existingArticle.excerpt       = data.excerpt;
        existingArticle.description   = data.description;
        existingArticle.status        = data.status;
        existingArticle.isPromoted    = data.isPromoted;

        const savedArticle = await this.article.save(existingArticle);
        if(!savedArticle) {
            return new ApiResponse('error', -5002, 'Could not save new article data.');

        }

        const newPriceString: string = Number(data.price).toFixed(2); // 50.1 -> "50.10"
        const lastPrice = existingArticle.articlePrices[existingArticle.articlePrices.length-1].price;
        const lastPriceString: string = Number(lastPrice).toFixed(2); // 50 -> "50.00"

        if (newPriceString !== lastPriceString){
            const newArticlePrice = new ArticlePrice();
            newArticlePrice.articleId = articleId;
            newArticlePrice.price = data.price;

           const savedArticlePrice = await this.articlePrice.save(newArticlePrice);
            if (!savedArticlePrice) {
                return new ApiResponse('error', -5003, 'Could not save the new article price.');

            }
        }

        if (data.features !==null) {
            await this.articleFeature.remove(existingArticle.articleFeatures);

            for (const feature of data.features) {
                const newArticleFeature: ArticleFeature = new ArticleFeature();
                newArticleFeature.articleId = articleId;
                newArticleFeature.featureId = feature.featureId;
                newArticleFeature.value     = feature.value;
    
               await this.articleFeature.save(newArticleFeature);
            }
        }
        return await this.article.findOne(articleId, {
            relations: [
                "category",
                "articleFeatures",
                "features",
                "articlePrices"
            ]
        });
    }

}