"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import StatusBanner from "@/components/StatusBanner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginFormSchema, type LoginFormValues } from "@/lib/validators";

interface LoginFormProps {
	onLogin: (token: string) => void;
	expiredMessage?: string;
}

export default function LoginForm({ onLogin, expiredMessage }: LoginFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(expiredMessage ?? null);

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginFormSchema),
		defaultValues: {
			username: "",
			password: "",
		},
	});

	async function onSubmit(values: LoginFormValues): Promise<void> {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});

			if (!response.ok) {
				let message = "An unexpected error occurred.";
				try {
					const body = (await response.json()) as { error?: string };
					message = body.error ?? message;
				} catch {
					// ignore JSON parse errors
				}
				setError(message);
				return;
			}

			const data = (await response.json()) as { token: string };
			onLogin(data.token);
		} catch {
			setError("Network error. Please check your connection and try again.");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="space-y-4">
			{error ? (
				<StatusBanner type="error" message={error} onDismiss={() => setError(null)} />
			) : null}

			<p className="text-sm text-gray-500">
				Log in with your Twistlock credentials to get started.
			</p>

			<Form {...form}>
				<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
					<FormField
						control={form.control}
						name="username"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Username</FormLabel>
								<FormControl>
									<Input
										placeholder="Enter your username"
										autoComplete="username"
										disabled={isLoading}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Password</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Enter your password"
										autoComplete="current-password"
										disabled={isLoading}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Logging in…" : "Log In"}
					</Button>
				</form>
			</Form>
		</div>
	);
}
