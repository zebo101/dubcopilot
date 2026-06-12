import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Label } from "@/components/ui/label";

export function NewFolderDialog({
	isOpen,
	onOpenChange,
	onConfirm,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (name: string) => void;
}) {
	const [name, setName] = useState("");

	const handleOpenChange = (open: boolean) => {
		if (open) {
			setName("");
		}
		onOpenChange(open);
	};

	const submit = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		onConfirm(trimmed);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>新建文件夹</DialogTitle>
				</DialogHeader>

				<DialogBody className="gap-3">
					<Label>文件夹名称</Label>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								submit();
							}
						}}
						placeholder="输入文件夹名称"
					/>
				</DialogBody>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onOpenChange(false);
						}}
					>
						取消
					</Button>
					<Button onClick={submit}>创建并移入</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
