/**
 * LocateAnything Router
 * =====================
 * tRPC router providing endpoints for NVIDIA LocateAnything-3B
 * visual grounding and object detection capabilities.
 *
 * Use cases in Portfoliomanager:
 * - Chart image analysis (detect patterns, trend lines, support/resistance)
 * - Document/PDF analysis (locate tables, key figures, data fields)
 * - Screenshot analysis for automated UI testing
 * - Logo/brand detection in financial documents
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  locateAnything,
  detectObjects,
  groundObject,
  analyzeChartImage,
  analyzeDocument,
  localizeText,
  denseDetection,
  type LocateAnythingResult,
} from "../_core/locateAnything";

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const imageInputSchema = z.object({
  /** URL of the image to analyze (HTTPS URL or base64 data URI) */
  imageUrl: z.string().min(1, "Image URL is required"),
});

const groundingInputSchema = imageInputSchema.extend({
  /** Natural language description of what to locate */
  query: z.string().min(1, "Query is required"),
});

const chartAnalysisInputSchema = imageInputSchema.extend({
  /** Optional custom analysis prompt */
  analysisPrompt: z.string().optional(),
});

const documentAnalysisInputSchema = imageInputSchema.extend({
  /** Optional focus area for document analysis */
  focusArea: z.string().optional(),
});

const customInputSchema = imageInputSchema.extend({
  /** Custom prompt for the model */
  prompt: z.string().min(1, "Prompt is required"),
  /** Generation mode */
  generationMode: z.enum(["fast", "slow", "hybrid"]).optional(),
  /** Max tokens */
  maxTokens: z.number().min(1).max(16384).optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const locateAnythingRouter = router({
  /**
   * General object detection — detect all objects in an image.
   */
  detectObjects: protectedProcedure
    .input(imageInputSchema)
    .mutation(async ({ input }): Promise<LocateAnythingResult> => {
      try {
        return await detectObjects(input.imageUrl);
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Object detection failed: ${error.message}`,
        });
      }
    }),

  /**
   * Grounding — locate a specific object described in natural language.
   */
  groundObject: protectedProcedure
    .input(groundingInputSchema)
    .mutation(async ({ input }): Promise<LocateAnythingResult> => {
      try {
        return await groundObject(input.imageUrl, input.query);
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Object grounding failed: ${error.message}`,
        });
      }
    }),

  /**
   * Chart analysis — detect patterns, trend lines, and key levels
   * in financial chart images.
   */
  analyzeChart: protectedProcedure
    .input(chartAnalysisInputSchema)
    .mutation(async ({ input }): Promise<LocateAnythingResult> => {
      try {
        return await analyzeChartImage(input.imageUrl, input.analysisPrompt);
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Chart analysis failed: ${error.message}`,
        });
      }
    }),

  /**
   * Document analysis — locate tables, figures, and key data in documents.
   */
  analyzeDocument: protectedProcedure
    .input(documentAnalysisInputSchema)
    .mutation(async ({ input }): Promise<LocateAnythingResult> => {
      try {
        return await analyzeDocument(input.imageUrl, input.focusArea);
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Document analysis failed: ${error.message}`,
        });
      }
    }),

  /**
   * OCR localization — locate all text elements with bounding boxes.
   */
  localizeText: protectedProcedure
    .input(imageInputSchema)
    .mutation(async ({ input }): Promise<LocateAnythingResult> => {
      try {
        return await localizeText(input.imageUrl);
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Text localization failed: ${error.message}`,
        });
      }
    }),

  /**
   * Dense detection — find all instances of every object category.
   */
  denseDetection: protectedProcedure
    .input(imageInputSchema)
    .mutation(async ({ input }): Promise<LocateAnythingResult> => {
      try {
        return await denseDetection(input.imageUrl);
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Dense detection failed: ${error.message}`,
        });
      }
    }),

  /**
   * Custom query — send a custom prompt with an image to LocateAnything.
   */
  custom: protectedProcedure
    .input(customInputSchema)
    .mutation(async ({ input }): Promise<LocateAnythingResult> => {
      try {
        return await locateAnything({
          imageUrl: input.imageUrl,
          prompt: input.prompt,
          generationMode: input.generationMode,
          maxTokens: input.maxTokens,
        });
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `LocateAnything custom query failed: ${error.message}`,
        });
      }
    }),
});
