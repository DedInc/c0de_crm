export interface Marker {
	id: string;
	name: string;
	color: string;
}

export interface PaymentMethodDetails {
	id: string;
	name: string;
	details: string;
}

export interface PaymentInfo {
	id: string;
	paymentMethodName: string;
	paymentDetails: string;
	programmerAmount: number;
	commissionAmount: number;
	totalAmount: number;
	createdAt: string | Date;
	providedBy: { id: string; username: string } | null;
}

export interface Order {
	id: string;
	title: string;
	description: string;
	cost: number;
	status: string;
	paymentMethod: string | null;
	paymentMethodDetails?: PaymentMethodDetails | null;
	customerTelegramId: string;
	customerName: string | null;
	createdAt: string;
	updatedAt: string;
	markers: Marker[];
	assignedTo: { id: string; username: string } | null;
	responses: {
		id: string;
		proposedPrice: number;
		message: string | null;
		createdAt: string;
		user?: { id: string; username: string; markers?: Marker[] };
	}[];
}
