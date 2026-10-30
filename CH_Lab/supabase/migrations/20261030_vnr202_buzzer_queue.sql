-- Standalone game: no changes to existing classroom or other game data.
create schema if not exists vnr202_private;
revoke all on schema vnr202_private from public, anon, authenticated;

create table vnr202_private.game (
  id boolean primary key default true check (id),
  phase text not null default 'lobby' check (phase in ('lobby','open','revealed','done')),
  question_index integer not null default 0,
  round integer not null default 0,
  queue integer[] not null default '{}',
  attempted integer[] not null default '{}',
  correct_group integer,
  host_key_hash text,
  host_token_hash text,
  host_last_seen timestamptz
);
insert into vnr202_private.game (id) values (true);

create table vnr202_private.groups (
  id integer primary key check (id in (1,3,4,5,6,7)),
  name text not null,
  score integer not null default 0 check (score >= 0),
  token_hash text unique,
  last_seen timestamptz
);
insert into vnr202_private.groups (id,name)
select id, 'Nhóm ' || id from unnest(array[1,3,4,5,6,7]) as id;

create table vnr202_private.questions (
  position integer primary key,
  id text not null unique,
  question text not null,
  options jsonb not null check (jsonb_array_length(options)=4),
  answer integer not null check (answer between 0 and 3),
  explanation text not null
);

-- Only a change counter is public. Sessions, scores and answers stay private.
create table public.vnr202_events (id boolean primary key default true check(id), version bigint not null default 0);
insert into public.vnr202_events(id) values(true);
alter table public.vnr202_events enable row level security;
revoke all on public.vnr202_events from public, anon, authenticated;
grant select on public.vnr202_events to anon, authenticated;
create policy vnr202_read_events on public.vnr202_events for select to anon, authenticated using (true);
alter table vnr202_private.game enable row level security;
alter table vnr202_private.groups enable row level security;
alter table vnr202_private.questions enable row level security;
revoke all on all tables in schema vnr202_private from public, anon, authenticated;

create function vnr202_private.session_hash(p_token text) returns text
language plpgsql immutable set search_path='' as $$
begin
  if p_token is null or p_token !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
    raise exception 'Phiên không hợp lệ. Hãy tải lại trang.';
  end if;
  return encode(sha256(convert_to(p_token,'UTF8')),'hex');
end;
$$;

create function vnr202_private.snapshot(p_hash text) returns jsonb
language plpgsql set search_path='' as $$
declare
  g vnr202_private.game;
  q vnr202_private.questions;
  me vnr202_private.groups;
  is_host boolean;
begin
  select * into g from vnr202_private.game;
  is_host := coalesce(g.host_token_hash=p_hash,false);
  if not is_host then
    select * into me from vnr202_private.groups where token_hash=p_hash;
    if not found then raise exception 'Phiên đã hết hiệu lực. Hãy vào lại nhóm.'; end if;
  end if;
  select * into q from vnr202_private.questions where position=g.question_index;
  return jsonb_build_object(
    'phase',g.phase, 'index',g.question_index, 'round',g.round,
    'revision',(select version from public.vnr202_events),
    'total',(select count(*) from vnr202_private.questions),
    'role',case when is_host then 'host' else 'group' end,
    'groupId',me.id, 'name',case when is_host then 'Người dẫn' else me.name end,
    'queue',to_jsonb(g.queue), 'attempted',to_jsonb(g.attempted),
    'activeGroup',case when g.phase='open' then g.queue[1] else null end,
    'correctGroup',g.correct_group,
    'position',array_position(g.queue,me.id),
    'canBuzz',not is_host and g.phase='open' and not(me.id=any(g.queue)) and not(me.id=any(g.attempted)),
    'question',case when is_host and g.phase in ('open','revealed') then
      jsonb_build_object('id',q.id,'question',q.question,'options',q.options) ||
      case when g.phase='revealed' then jsonb_build_object('answer',q.answer,'explanation',q.explanation) else '{}'::jsonb end
      else null end,
    'correctLetter',case when g.phase='revealed' then chr(65+q.answer) else null end,
    'groups',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'score',score,
      'connected',coalesce(last_seen>clock_timestamp()-interval '30 seconds',false)) order by id) from vnr202_private.groups)
  );
end;
$$;

create function public.vnr202_join(p_token text,p_role text,p_group_id integer default null,p_name text default '',p_host_key text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  h text := vnr202_private.session_hash(p_token);
  g vnr202_private.game;
  team vnr202_private.groups;
begin
  select * into g from vnr202_private.game for update;
  if p_role='host' then
    if g.host_key_hash is null or g.host_key_hash<>encode(sha256(convert_to(coalesce(p_host_key,''),'UTF8')),'hex') then
      raise exception 'Mã người dẫn không đúng.';
    end if;
    if g.host_token_hash is distinct from h and g.host_last_seen>clock_timestamp()-interval '30 seconds' then
      raise exception 'Đã có màn hình người dẫn đang mở.';
    end if;
    if exists(select 1 from vnr202_private.groups where token_hash=h) then raise exception 'Phiên đã dùng cho nhóm.'; end if;
    update vnr202_private.game set host_token_hash=h,host_last_seen=clock_timestamp();
  elsif p_role='group' then
    select * into team from vnr202_private.groups where id=p_group_id;
    if not found then raise exception 'Chọn nhóm 1, 3, 4, 5, 6 hoặc 7.'; end if;
    if team.token_hash is distinct from h and team.last_seen>clock_timestamp()-interval '30 seconds' then
      raise exception 'Nhóm % đã có thiết bị đại diện.',p_group_id;
    end if;
    if g.host_token_hash=h or exists(select 1 from vnr202_private.groups where token_hash=h and id<>p_group_id) then
      raise exception 'Phiên đã dùng cho nhóm khác.';
    end if;
    update vnr202_private.groups set token_hash=h,last_seen=clock_timestamp(),
      name=coalesce(nullif(left(btrim(p_name),24),''),'Nhóm ' || id) where id=p_group_id;
  else raise exception 'Vai trò không hợp lệ.';
  end if;
  update public.vnr202_events set version=version+1;
  return vnr202_private.snapshot(h);
end;
$$;

create function public.vnr202_state(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text := vnr202_private.session_hash(p_token);
begin
  if exists(select 1 from vnr202_private.game where host_token_hash=h) then
    update vnr202_private.game set host_last_seen=clock_timestamp() where host_token_hash=h;
  else
    update vnr202_private.groups set last_seen=clock_timestamp() where token_hash=h;
  end if;
  return vnr202_private.snapshot(h);
end;
$$;

create function public.vnr202_action(p_token text,p_action text,p_round integer,p_active_group integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  h text := vnr202_private.session_hash(p_token);
  g vnr202_private.game;
  team_id integer;
  is_host boolean;
begin
  -- Serialize every command on the same row, including nearly simultaneous buzzes.
  select * into g from vnr202_private.game for update;
  is_host:=coalesce(g.host_token_hash=h,false);
  select id into team_id from vnr202_private.groups where token_hash=h;
  if not is_host and team_id is null then raise exception 'Phiên đã hết hiệu lực. Hãy vào lại nhóm.'; end if;
  if p_action is null or p_action not in ('buzz','start','next','correct','wrong','reveal','reset') then raise exception 'Lệnh không hợp lệ.'; end if;
  if p_action<>'buzz' and not is_host then raise exception 'Chỉ người dẫn được điều khiển trò chơi.'; end if;
  if p_round is distinct from g.round then return vnr202_private.snapshot(h); end if;

  if p_action='buzz' then
    if team_id is null or g.phase<>'open' or team_id=any(g.queue) or team_id=any(g.attempted) then return vnr202_private.snapshot(h); end if;
    update vnr202_private.game set queue=array_append(queue,team_id);
  elsif p_action='start' then
    if g.phase not in ('lobby','done') then return vnr202_private.snapshot(h); end if;
    update vnr202_private.groups set score=0;
    update vnr202_private.game set phase='open',question_index=0,round=round+1,queue='{}',attempted='{}',correct_group=null;
  elsif p_action='next' then
    if g.phase<>'revealed' then return vnr202_private.snapshot(h); end if;
    update vnr202_private.game set question_index=question_index+1,round=round+1,queue='{}',attempted='{}',correct_group=null,
      phase=case when question_index+1>=(select count(*) from vnr202_private.questions) then 'done' else 'open' end;
  elsif p_action in ('correct','wrong') then
    if g.phase<>'open' or g.queue[1] is null or g.queue[1] is distinct from p_active_group then return vnr202_private.snapshot(h); end if;
    if p_action='correct' then
      update vnr202_private.groups set score=score+1 where id=g.queue[1];
      update vnr202_private.game set phase='revealed',correct_group=g.queue[1];
    else
      update vnr202_private.game set queue=queue[2:cardinality(queue)],attempted=array_append(attempted,g.queue[1]);
    end if;
  elsif p_action='reveal' then
    if g.phase<>'open' then return vnr202_private.snapshot(h); end if;
    update vnr202_private.game set phase='revealed';
  elsif p_action='reset' then
    update vnr202_private.groups set score=0;
    update vnr202_private.game set phase='lobby',question_index=0,round=round+1,queue='{}',attempted='{}',correct_group=null;
  end if;
  update public.vnr202_events set version=version+1;
  return vnr202_private.snapshot(h);
end;
$$;

revoke all on all functions in schema vnr202_private from public, anon, authenticated;
revoke all on function public.vnr202_join(text,text,integer,text,text) from public;
revoke all on function public.vnr202_state(text) from public;
revoke all on function public.vnr202_action(text,text,integer,integer) from public;
grant execute on function public.vnr202_join(text,text,integer,text,text) to anon,authenticated;
grant execute on function public.vnr202_state(text) to anon,authenticated;
grant execute on function public.vnr202_action(text,text,integer,integer) to anon,authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and
    not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vnr202_events') then
    alter publication supabase_realtime add table public.vnr202_events;
  end if;
end $$;

insert into vnr202_private.questions(position,id,question,options,answer,explanation) values
(0,'geneva-context','Hiệp định nào tạo bối cảnh cho cuộc di cư Bắc – Nam năm 1954?','["Hiệp định Paris","Hiệp định Giơnevơ","Hiệp định Sơ bộ","Hiệp định Élysée"]'::jsonb,1,'Hiệp định Giơnevơ năm 1954 quy định việc đình chỉ chiến sự, tập kết quân đội và tạo cơ sở pháp lý cho thường dân chuyển vùng cư trú trong thời hạn chuyển quân.'),
(1,'migration-direction','Cuộc di cư được đề cập trong bài chủ yếu diễn ra theo hướng nào?','["Miền Nam ra miền Bắc","Việt Nam sang Pháp","Miền Bắc sang Trung Quốc","Miền Bắc vào miền Nam"]'::jsonb,3,'Sau Hiệp định Giơnevơ, một bộ phận lớn dân cư miền Bắc di chuyển vào miền Nam trong giai đoạn 1954–1955.'),
(2,'article-14d','Điều khoản nào của Hiệp định đình chỉ chiến sự cho phép thường dân chuyển vùng cư trú?','["Điều 14(d)","Điều 1","Điều 20","Điều 35"]'::jsonb,0,'Điều 14(d) quy định thường dân muốn chuyển sang vùng bên kia phải được chính quyền địa phương cho phép và giúp đỡ trong thời hạn chuyển quân.'),
(3,'300-days','Thời hạn chuyển quân được Hiệp định Giơnevơ quy định tối đa bao nhiêu ngày?','["90 ngày","180 ngày","300 ngày","365 ngày"]'::jsonb,2,'Hiệp định quy định thời hạn tối đa 300 ngày để hoàn thành việc tập kết và chuyển quân. Đây cũng là thời kỳ thường dân được thực hiện quyền chuyển vùng theo Điều 14(d).'),
(4,'diem-political-goal','Một mục tiêu chính trị của việc thúc đẩy di cư vào Nam là gì?','["Phát triển du lịch","Củng cố cơ sở ủng hộ chính quyền Ngô Đình Diệm","Xóa bỏ toàn bộ tôn giáo","Đưa dân cư sang Mỹ"]'::jsonb,1,'Mỹ và chính quyền Diệm xem việc thu hút dân cư miền Bắc, đặc biệt những người được kỳ vọng có lập trường chống cộng, là một biện pháp củng cố lực lượng chính trị và xã hội ở miền Nam.'),
(5,'catholic-anticommunist','Nhóm dân cư nào được chính quyền Diệm đặc biệt quan tâm thu hút vào Nam?','["Người nước ngoài","Chỉ quân nhân Pháp","Chỉ công nhân công nghiệp","Người Công giáo và các thành phần chống cộng"]'::jsonb,3,'Trong các trao đổi ngoại giao năm 1954, Ngô Đình Diệm đề nghị Mỹ hỗ trợ đưa những người Công giáo và các nhóm chống cộng từ miền Bắc vào miền Nam.'),
(6,'passage-to-freedom','Chiến dịch vận chuyển người di cư do Hải quân Mỹ thực hiện có tên gì?','["Rolling Thunder","Linebacker","Passage to Freedom","Market Time"]'::jsonb,2,'Operation Passage to Freedom là chiến dịch Hải quân Mỹ tham gia vận chuyển người di cư từ miền Bắc vào miền Nam sau Hiệp định Giơnevơ.'),
(7,'ships-planes','Phương tiện chủ yếu được sử dụng để đưa người di cư vào Nam là gì?','["Tàu biển và máy bay","Xe đạp và xe máy","Tàu điện ngầm","Chỉ đi bộ"]'::jsonb,0,'Mỹ và Pháp sử dụng tàu biển, máy bay để vận chuyển người di cư. Tàu biển đảm nhận phần lớn số người được chuyên chở.'),
(8,'propaganda','Nội dung nào được sử dụng trong tuyên truyền vận động người dân di cư?','["Khuyến khích du lịch quốc tế","Tuyên truyền về thể thao","Giới thiệu chương trình du học","Khơi gợi lo ngại về tôn giáo, tài sản và an toàn"]'::jsonb,3,'Một số hoạt động tuyên truyền nhấn mạnh những lo ngại về tự do tôn giáo, quyền sở hữu tài sản và sự an toàn nhằm vận động người dân lựa chọn vào Nam.'),
(9,'land-promise','Lời hứa nào được sử dụng để thu hút người dân vào Nam?','["Miễn toàn bộ nghĩa vụ công dân","Hỗ trợ đất đai và điều kiện định cư","Đưa tất cả người dân ra nước ngoài","Phát vàng cho mọi gia đình"]'::jsonb,1,'Chính quyền Diệm và các tổ chức hỗ trợ di cư đưa ra những triển vọng về nhà ở, đất đai và sinh kế, tuy nhiên việc thực hiện trên thực tế gặp nhiều khó khăn.'),
(10,'mixed-motives','Nhận định nào đúng nhất về nguyên nhân người dân di cư năm 1954–1955?','["Tất cả bị ép buộc","Tất cả chỉ vì kinh tế","Có nhiều động cơ đan xen như tôn giáo, gia đình, chính trị và sinh kế","Tất cả đều là quân nhân"]'::jsonb,2,'Người dân ra đi vì nhiều nguyên nhân khác nhau. Có người lo ngại về chính trị, tôn giáo, có người đi theo gia đình hoặc tìm kiếm điều kiện sinh sống tốt hơn. Không nên quy tất cả trường hợp vào một nguyên nhân duy nhất.'),
(11,'nearly-one-million','Quy mô người di cư từ Bắc vào Nam năm 1954–1955 thường được khái quát khoảng bao nhiêu?','["Gần 1 triệu người","10.000 người","50.000 người","5 triệu người"]'::jsonb,0,'Các tài liệu lịch sử thường nêu khoảng 800.000 đến gần một triệu người di cư từ miền Bắc vào miền Nam. Con số cụ thể thay đổi tùy nguồn và cách thống kê.'),
(12,'settlement-hardship','Khó khăn lớn trong quá trình ổn định đời sống người di cư tại miền Nam là gì?','["Không có phương tiện truyền thông","Không có bất kỳ hoạt động cứu trợ nào","Không có người dân tham gia di cư","Thiếu đất canh tác, công cụ sản xuất và điều kiện định cư ổn định"]'::jsonb,3,'Việc vận chuyển người di cư chỉ là bước đầu. Nhiều người còn gặp khó khăn về nhà ở, đất sản xuất, công cụ lao động và việc làm sau khi đến miền Nam.'),
(13,'heath-telegram','Điện tín ngày 23/7/1954 ghi nhận đề nghị Mỹ hỗ trợ di cư của Ngô Đình Diệm do ai gửi?','["Dwight Eisenhower","Donald Heath","Henry Kissinger","John F. Kennedy"]'::jsonb,1,'Donald Heath là Đại sứ Mỹ tại Việt Nam, người gửi điện tín ngày 23/7/1954 ghi nhận đề nghị hỗ trợ di cư từ phía Ngô Đình Diệm.'),
(14,'distinguish-goals','Khi đánh giá chính sách di cư năm 1954, cần phân biệt điều gì?','["Di cư đường biển và đường bộ","Người trẻ và người già","Mục tiêu chính trị của chính quyền với động cơ cá nhân của người di cư","Miền núi và đồng bằng"]'::jsonb,2,'Mỹ và chính quyền Diệm có những mục tiêu chính trị trong việc hỗ trợ và tổ chức di cư. Tuy nhiên, từng người dân có hoàn cảnh và lý do riêng, có thể tự nguyện, chịu ảnh hưởng tuyên truyền hoặc bị gây sức ép.');
