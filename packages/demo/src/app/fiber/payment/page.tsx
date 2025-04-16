"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";

interface PaymentForm {
  amount: string;
  recipient: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  const handlePayment = async () => {
    try {
      setLoading(true);
      // TODO: 实现支付逻辑
      alert("支付成功！");
      router.push("/fiber");
    } catch (error) {
      alert("支付失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">支付</h1>
      </div>

      <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
        <div className="flex w-full flex-col items-center items-stretch gap-2">
          <TextInput
            label="金额"
            state={[amount, setAmount]}
            placeholder="请输入支付金额"
          />
          <TextInput
            label="收款方地址"
            state={[recipient, setRecipient]}
            placeholder="请输入收款方地址"
          />
        </div>
      </div>

      <ButtonsPanel>
        <Button onClick={() => router.push("/")}>Back</Button>
        <Button onClick={handlePayment} disabled={loading}>
          确认支付
        </Button>
      </ButtonsPanel>
    </div>
  );
}
