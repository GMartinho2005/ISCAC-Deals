import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TicketSuporte, getTicketsByEmail } from '../src/services/database';

type Props = {
  email: string;
};

export default function SuporteTicketList({ email }: Props) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketSuporte[]>([]);

  useEffect(() => {
    if (!email) return;
    getTicketsByEmail(email).then(setTickets);
  }, [email]);

  if (tickets.length === 0) return null;

  return (
    <View className="mt-6 mb-10">
      <Text className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-3 px-1">
        Os teus pedidos de suporte
      </Text>
      
      {tickets.map((ticket) => (
        <Pressable
          key={ticket.id}
          onPress={() => 
            router.push({ 
              pathname: '/suporte-chat', 
              params: { ticketId: ticket.id.toString(), assunto: ticket.assunto } 
            })
          }
          className="flex-row items-center bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 active:opacity-70"
        >
          <View className="w-12 h-12 rounded-full bg-white/10 items-center justify-center mr-4 border border-white/20">
            <Ionicons name="help-circle" size={28} color="rgba(255,255,255,0.6)" />
          </View>
          
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-0.5">
              <Text className="text-white font-bold text-[14px] flex-1 mr-2" numberOfLines={1}>
                {ticket.assunto}
              </Text>
              
              <View className={`px-2 py-0.5 rounded-full ${ticket.resolvido ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                <Text className={`text-[10px] font-bold uppercase ${ticket.resolvido ? 'text-green-400' : 'text-orange-400'}`}>
                  {ticket.resolvido ? 'Resolvido' : 'Aberto'}
                </Text>
              </View>
            </View>
            
            <Text className="text-gray-400 text-[12px]" numberOfLines={1}>
              {ticket.mensagem}
            </Text>
          </View>
          
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" className="ml-2" />
        </Pressable>
      ))}
    </View>
  );
}