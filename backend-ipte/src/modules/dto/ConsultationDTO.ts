export type ConsultationDTO = {
    consultationId?: number;
    name: string;
    email: string;
    phone?: string | null;
    courseId?: number | null;
    message?: string | null;
    status?: string;
    targetScore?: string | null;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string | null;
    updatedBy?: string | null;
    version?: number | null;
};
