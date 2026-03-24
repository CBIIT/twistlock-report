import { z } from "zod";

export const reportFormSchema = z.object({
	projectName: z.string().optional(),
	tpm: z.string().optional(),
	microserviceName: z.string().min(1, "Microservice name is required"),
	imageName: z.string().min(1, "Image name is required"),
	imageTag: z.string().min(1, "Image tag is required"),
	twistlockToken: z.string().min(1, "Twistlock token is required"),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

const selectionItem = z.object({
	imageName: z.string().min(1, "Image name is required"),
	imageTag: z.string().min(1, "Image tag is required"),
});

export const batchReportFormSchema = z.object({
	projectName: z.string().optional(),
	tpm: z.string().optional(),
	selections: z.array(selectionItem).min(1, "At least one selection is required"),
	twistlockToken: z.string().min(1, "Twistlock token is required"),
});

export type BatchReportFormValues = z.infer<typeof batchReportFormSchema>;

export const searchFormSchema = z.object({
	projectName: z.string().min(1, "Project name is required"),
	tpm: z.string().optional(),
	twistlockToken: z.string().min(1, "Twistlock token is required"),
});

export type SearchFormValues = z.infer<typeof searchFormSchema>;
