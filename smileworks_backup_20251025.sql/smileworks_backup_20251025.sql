-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: localhost    Database: smileworks
-- ------------------------------------------------------
-- Server version	8.0.43-0ubuntu0.24.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `paciente_id` int DEFAULT NULL,
  `medico_id` int DEFAULT NULL,
  `fecha` date DEFAULT NULL,
  `hora_inicio` time DEFAULT NULL,
  `hora_fin` time DEFAULT NULL,
  `motivo` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_appt_paciente` (`paciente_id`),
  KEY `idx_appt_medico` (`medico_id`),
  CONSTRAINT `fk_appt_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_appt_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=194 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES (126,5,1,'2025-10-19','12:00:00','13:00:00','Control de diabetes'),(129,8,1,'2025-10-30','13:45:00','14:15:00','Chequeo de presión'),(131,10,1,'2025-10-18','15:15:00','15:45:00','Control de diabetes'),(132,11,1,'2025-10-21','09:00:00','10:00:00','Consulta general'),(133,12,1,'2025-10-21','10:00:00','11:00:00','Revisión dental'),(134,13,1,'2025-10-21','12:00:00','12:30:00','Chequeo de presión'),(135,14,1,'2025-10-21','11:00:00','12:00:00','Dolor abdominal'),(136,15,1,'2025-10-21','12:30:00','13:30:00','Control de diabetes'),(137,16,1,'2025-10-21','13:30:00','14:00:00','Consulta general'),(139,18,1,'2025-10-19','14:00:00','15:30:00','Chequeo de presión'),(143,22,1,'2025-10-16','09:15:00','09:45:00','Revisión dental'),(144,23,1,'2025-10-16','10:00:00','10:30:00','Chequeo de presión'),(145,24,1,'2025-10-16','10:45:00','11:15:00','Dolor abdominal'),(146,25,1,'2025-10-16','11:30:00','12:00:00','Control de diabetes'),(147,26,1,'2025-10-16','12:15:00','12:45:00','Consulta general'),(148,27,1,'2025-10-16','13:00:00','13:30:00','Revisión dental'),(149,28,1,'2025-10-16','13:45:00','14:15:00','Chequeo de presión'),(150,29,1,'2025-10-16','14:30:00','15:00:00','Dolor abdominal'),(152,1,1,'2025-10-30','08:30:00','09:00:00','Consulta general'),(153,2,1,'2025-11-01','11:00:00','12:00:00','Revisión dental'),(154,3,1,'2025-10-17','10:00:00','10:30:00','Chequeo de presión'),(155,4,1,'2025-10-17','10:45:00','11:15:00','Dolor abdominal'),(156,5,1,'2025-10-17','11:30:00','12:00:00','Control de diabetes'),(157,6,1,'2025-10-17','12:15:00','12:45:00','Consulta general'),(158,7,1,'2025-10-17','13:00:00','13:30:00','Revisión dental'),(159,8,1,'2025-10-17','13:45:00','14:15:00','Chequeo de presión'),(160,9,1,'2025-10-30','14:30:00','15:00:00','Dolor abdominal'),(163,12,1,'2025-10-27','11:00:00','11:30:00','Revisión dental'),(165,14,1,'2025-10-18','10:45:00','11:15:00','Dolor abdominal'),(166,15,1,'2025-10-18','11:30:00','12:00:00','Control de diabetes'),(167,16,1,'2025-10-18','12:15:00','12:45:00','Consulta general'),(168,17,1,'2025-10-18','13:00:00','13:30:00','Revisión dental'),(169,18,1,'2025-10-18','13:45:00','14:15:00','Chequeo de presión'),(170,19,1,'2025-10-18','14:30:00','15:00:00','Dolor abdominal'),(172,6,1,'2025-10-30','10:00:00','10:30:00','PRUEBAS'),(173,6,1,'2025-10-30','10:30:00','11:00:00','PRUEBAS'),(174,6,1,'2025-10-30','11:00:00','11:30:00','PRUEBAS'),(175,6,1,'2025-10-30','11:30:00','12:00:00','PRUEBAS'),(176,3,1,'2025-10-30','12:00:00','13:00:00','PRUEBAS 2'),(177,3,1,'2025-10-30','09:30:00','10:00:00','PRUEBAS'),(178,9,1,'2025-10-31','10:00:00','12:00:00','PRUEBAS'),(179,6,1,'2025-10-31','12:00:00','13:00:00','PRUEBAS 2'),(180,6,1,'2025-11-01','09:00:00','11:00:00','PRUEBAS 2'),(181,3,1,'2025-10-31','09:00:00','10:00:00','PRUEBAS 2'),(182,3,1,'2025-11-01','16:00:00','16:30:00','PRUEBAS'),(183,3,1,'2025-11-01','12:00:00','12:30:00','PRUEBAS'),(184,11,1,'2025-11-01','13:00:00','15:00:00','PRUEBAS'),(186,3,1,'2025-10-27','10:00:00','11:00:00','PRUEBAS 2'),(187,6,1,'2025-10-19','09:00:00','10:00:00','DOLOR DE MUELAS'),(188,11,1,'2025-10-19','10:00:00','11:00:00','PRUEBAS'),(189,3,1,'2025-10-19','11:00:00','12:00:00','PRUEBAS 23'),(190,3,1,'2025-10-20','11:30:00','15:00:00','DOLOR DE MUELAS'),(191,6,1,'2025-10-25','09:00:00','10:30:00','DOLOR DE MUELAS'),(192,3,1,'2025-10-25','10:30:00','11:00:00','DOLOR DE MUELAS'),(193,6,1,'2025-10-28','10:00:00','10:30:00','DOLOR DE MUELAS');
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario`
--

DROP TABLE IF EXISTS `formulario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `paciente_id` int NOT NULL,
  `tipo_id` bigint NOT NULL,
  `estado` enum('borrador','firmado','cerrado') COLLATE utf8mb4_unicode_ci DEFAULT 'borrador',
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `creado_por` int DEFAULT NULL,
  `actualizado_por` int DEFAULT NULL,
  `eliminado_logico` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_form_creado_por` (`creado_por`),
  KEY `fk_form_actualizado_por` (`actualizado_por`),
  KEY `idx_form_paciente` (`paciente_id`),
  KEY `idx_form_tipo` (`tipo_id`),
  KEY `idx_form_estado` (`estado`),
  CONSTRAINT `fk_form_actualizado_por` FOREIGN KEY (`actualizado_por`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_form_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_form_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_form_tipo` FOREIGN KEY (`tipo_id`) REFERENCES `formulario_tipo` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario`
--

LOCK TABLES `formulario` WRITE;
/*!40000 ALTER TABLE `formulario` DISABLE KEYS */;
INSERT INTO `formulario` VALUES (4,2,10,'borrador','2025-10-19 03:56:58','2025-10-19 03:56:58',2,NULL,0),(5,27,10,'borrador','2025-10-19 04:04:30','2025-10-19 04:04:30',2,NULL,0),(6,22,10,'borrador','2025-10-19 04:30:18','2025-10-19 04:30:18',2,NULL,0),(7,15,10,'borrador','2025-10-19 04:31:17','2025-10-19 04:31:17',2,NULL,0),(8,15,10,'borrador','2025-10-19 04:47:40','2025-10-19 04:47:40',2,NULL,0),(9,15,10,'borrador','2025-10-19 04:48:22','2025-10-19 04:48:22',2,NULL,0),(10,24,10,'borrador','2025-10-19 04:52:09','2025-10-19 04:52:09',2,NULL,0),(11,26,10,'borrador','2025-10-19 13:12:31','2025-10-19 13:12:31',2,NULL,0),(12,26,6,'firmado','2025-10-19 13:34:03','2025-10-19 13:34:03',2,NULL,0),(13,26,6,'firmado','2025-10-19 13:37:40','2025-10-19 13:37:40',2,NULL,0),(14,15,3,'firmado','2025-10-19 14:24:25','2025-10-19 14:24:25',2,NULL,0),(15,15,3,'firmado','2025-10-19 14:46:39','2025-10-19 14:46:39',2,NULL,0),(16,17,10,'borrador','2025-10-19 14:57:28','2025-10-19 14:57:28',2,NULL,0),(17,17,3,'firmado','2025-10-19 14:58:16','2025-10-19 14:58:16',2,NULL,0),(18,17,6,'firmado','2025-10-19 14:59:11','2025-10-19 14:59:11',2,NULL,0),(19,12,10,'borrador','2025-10-19 15:50:17','2025-10-19 15:50:17',2,NULL,0),(20,23,1,'borrador','2025-10-19 15:59:34','2025-10-19 15:59:34',2,NULL,0),(21,23,1,'firmado','2025-10-19 16:12:59','2025-10-19 16:12:59',2,NULL,0),(22,23,1,'firmado','2025-10-19 16:18:42','2025-10-19 16:18:42',2,NULL,0),(23,23,1,'firmado','2025-10-19 16:29:06','2025-10-19 16:29:06',2,NULL,0),(24,23,10,'borrador','2025-10-19 16:38:13','2025-10-19 16:38:13',2,NULL,0),(25,23,6,'firmado','2025-10-19 16:43:15','2025-10-19 16:43:15',2,NULL,0),(26,23,3,'firmado','2025-10-19 16:56:34','2025-10-19 16:56:34',2,NULL,0),(27,12,5,'borrador','2025-10-19 20:47:11','2025-10-19 20:47:11',2,NULL,0),(29,21,5,'borrador','2025-10-19 21:04:04','2025-10-19 21:04:04',2,NULL,0),(31,23,8,'borrador','2025-10-19 22:24:05','2025-10-19 22:24:05',2,NULL,0),(32,8,8,'borrador','2025-10-19 22:29:57','2025-10-19 22:29:57',2,NULL,0),(33,8,8,'borrador','2025-10-19 22:39:53','2025-10-19 22:39:53',2,NULL,0),(34,8,8,'borrador','2025-10-19 22:40:12','2025-10-19 22:40:12',2,NULL,0),(35,8,8,'borrador','2025-10-19 22:45:48','2025-10-19 22:45:48',2,NULL,0),(36,23,8,'borrador','2025-10-19 22:46:55','2025-10-19 22:46:55',2,NULL,0),(37,26,8,'borrador','2025-10-19 22:51:41','2025-10-19 22:51:41',2,NULL,0),(38,26,10,'borrador','2025-10-19 22:53:34','2025-10-19 22:53:34',2,NULL,0),(39,26,8,'borrador','2025-10-19 22:53:48','2025-10-19 22:53:48',2,NULL,0),(40,26,8,'borrador','2025-10-19 23:04:54','2025-10-19 23:04:54',2,NULL,0),(41,26,8,'borrador','2025-10-19 23:11:50','2025-10-19 23:11:50',2,NULL,0),(42,26,8,'borrador','2025-10-19 23:18:05','2025-10-19 23:18:05',2,NULL,0),(43,26,6,'firmado','2025-10-19 23:19:46','2025-10-19 23:19:46',2,NULL,0),(44,26,8,'borrador','2025-10-19 23:22:14','2025-10-19 23:22:14',2,NULL,0),(45,21,8,'borrador','2025-10-20 00:07:08','2025-10-20 00:07:08',2,NULL,0),(46,21,8,'borrador','2025-10-20 01:17:12','2025-10-20 01:17:12',2,NULL,0),(47,21,8,'borrador','2025-10-20 01:27:11','2025-10-20 01:27:11',2,NULL,0),(48,21,8,'borrador','2025-10-20 01:30:59','2025-10-20 01:30:59',2,NULL,0),(49,25,5,'borrador','2025-10-20 02:21:14','2025-10-20 02:21:14',2,NULL,0),(50,25,10,'borrador','2025-10-20 02:21:42','2025-10-20 02:21:42',2,NULL,0),(51,25,3,'firmado','2025-10-20 02:22:16','2025-10-20 02:22:16',2,NULL,0),(52,25,1,'firmado','2025-10-20 02:23:12','2025-10-20 02:23:12',2,NULL,0),(53,25,1,'firmado','2025-10-20 02:23:14','2025-10-20 02:23:14',2,NULL,0),(54,25,6,'firmado','2025-10-20 02:24:02','2025-10-20 02:24:02',2,NULL,0),(58,25,8,'borrador','2025-10-21 12:03:41','2025-10-21 12:03:41',2,NULL,0),(59,22,10,'borrador','2025-10-21 12:05:08','2025-10-21 12:05:08',2,NULL,0),(60,22,5,'borrador','2025-10-21 12:06:07','2025-10-21 12:06:07',2,NULL,0),(61,22,3,'firmado','2025-10-21 12:07:06','2025-10-21 12:07:06',2,NULL,0),(62,22,1,'firmado','2025-10-21 12:07:53','2025-10-21 12:07:53',2,NULL,0),(63,22,6,'firmado','2025-10-21 12:08:56','2025-10-21 12:08:56',2,NULL,0),(64,22,8,'borrador','2025-10-21 12:09:45','2025-10-21 12:09:45',2,NULL,0),(65,25,6,'firmado','2025-10-24 17:54:39','2025-10-24 17:54:39',2,NULL,0),(66,10,10,'borrador','2025-10-24 18:31:22','2025-10-24 18:31:22',2,NULL,0);
/*!40000 ALTER TABLE `formulario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_consent_odont`
--

DROP TABLE IF EXISTS `formulario_consent_odont`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_consent_odont` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `fecha` date NOT NULL,
  `numero_paciente` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tratamiento` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `ausencia_dias` int NOT NULL,
  `autorizacion_check` tinyint(1) NOT NULL,
  `economico_check` tinyint(1) NOT NULL,
  `ausencia_check` tinyint(1) NOT NULL,
  `firma_paciente_at` datetime DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_co_fecha` (`fecha`),
  KEY `idx_co_paciente` (`paciente_id`),
  KEY `idx_co_medico` (`medico_id`),
  KEY `idx_consent_odont_fecha` (`fecha`),
  CONSTRAINT `fk_co_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_co_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_co_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_consent_odont`
--

LOCK TABLES `formulario_consent_odont` WRITE;
/*!40000 ALTER TABLE `formulario_consent_odont` DISABLE KEYS */;
INSERT INTO `formulario_consent_odont` VALUES (14,15,1,'2025-10-19','15','SON PRUEBAS',5000.00,25,1,1,1,NULL,'2025-10-19 14:24:25','2025-10-19 14:24:25'),(15,15,1,'2025-10-19','15','PRUEBAS DE NUEVO SI ',500.00,30,1,1,1,NULL,'2025-10-19 14:46:39','2025-10-19 14:46:39'),(17,17,1,'2025-10-19','17','son pruebas para validar',500.00,23,1,1,1,NULL,'2025-10-19 14:58:16','2025-10-19 14:58:16'),(26,23,1,'2025-10-19','23','pruebas ',500.00,30,1,1,1,NULL,'2025-10-19 16:56:34','2025-10-19 16:56:34'),(51,25,1,'2025-10-20','25','preubas a realizar',500.00,23,1,1,1,NULL,'2025-10-20 02:22:16','2025-10-20 02:22:16'),(61,22,1,'2025-10-21','22','son pruebas a realizar',500.00,25,1,1,1,NULL,'2025-10-21 12:07:06','2025-10-21 12:07:06');
/*!40000 ALTER TABLE `formulario_consent_odont` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_consent_quiro`
--

DROP TABLE IF EXISTS `formulario_consent_quiro`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_consent_quiro` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `fecha` date NOT NULL,
  `numero_paciente` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pronostico` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `condiciones_posop` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `recuperacion_dias` int NOT NULL,
  `historia_aceptada` tinyint(1) NOT NULL,
  `anestesia_consentida` tinyint(1) NOT NULL,
  `pronostico_entendido` tinyint(1) NOT NULL,
  `recuperacion_entendida` tinyint(1) NOT NULL,
  `responsabilidad_aceptada` tinyint(1) NOT NULL,
  `economico_aceptado` tinyint(1) NOT NULL,
  `acuerdo_economico` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `firma_paciente_at` datetime DEFAULT NULL,
  `firma_medico_at` datetime DEFAULT NULL,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_consent_quiro_fecha` (`fecha`),
  KEY `idx_consent_quiro_paciente` (`paciente_id`),
  KEY `idx_consent_quiro_medico` (`medico_id`),
  CONSTRAINT `fk_consent_quiro_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_consent_quiro_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_consent_quiro_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_consent_quiro`
--

LOCK TABLES `formulario_consent_quiro` WRITE;
/*!40000 ALTER TABLE `formulario_consent_quiro` DISABLE KEYS */;
INSERT INTO `formulario_consent_quiro` VALUES (20,23,1,'2025-10-19','23','PRUEBAS','PRUEBAS',5,1,1,1,1,1,1,'5200',NULL,NULL),(21,23,1,'2025-10-19','23','pruebas a realizar','pruebas a realizar',5,1,1,1,1,1,1,'5200',NULL,NULL),(22,23,1,'2025-10-19','23','PRUEBAS X3','PRUEBAS X3',5,1,1,1,1,1,1,'5200',NULL,NULL),(23,23,1,'2025-10-19','23','PRUEBAS SI','PRUEBAS SI',9,1,1,1,1,1,1,'5200',NULL,NULL),(52,25,1,'2025-10-20','25','preubas a realizar','preubas a realizar',5,1,1,1,1,1,1,'5200',NULL,NULL),(53,25,1,'2025-10-20','25','preubas a realizar','preubas a realizar',5,1,1,1,1,1,1,'5200',NULL,NULL),(62,22,1,'2025-10-21','22','son pruebas a realizar','son pruebas a realizar',5,0,1,1,1,1,1,'5200',NULL,NULL);
/*!40000 ALTER TABLE `formulario_consent_quiro` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_diag_infantil`
--

DROP TABLE IF EXISTS `formulario_diag_infantil`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_diag_infantil` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `fecha` date NOT NULL,
  `numero_paciente` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `odontograma_json` json DEFAULT NULL,
  `tratamientos_por_diente_json` json DEFAULT NULL,
  `tratamientos_generales_json` json DEFAULT NULL,
  `meses` int NOT NULL DEFAULT '1',
  `total_costo` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_mensual` decimal(10,2) NOT NULL DEFAULT '0.00',
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_pxinf_fecha` (`fecha`),
  KEY `idx_pxinf_paciente` (`paciente_id`),
  KEY `idx_pxinf_medico` (`medico_id`),
  CONSTRAINT `fk_pxinf_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pxinf_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pxinf_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `formulario_diag_infantil_chk_1` CHECK (((`odontograma_json` is null) or json_valid(`odontograma_json`))),
  CONSTRAINT `formulario_diag_infantil_chk_2` CHECK (((`tratamientos_por_diente_json` is null) or json_valid(`tratamientos_por_diente_json`))),
  CONSTRAINT `formulario_diag_infantil_chk_3` CHECK (((`tratamientos_generales_json` is null) or json_valid(`tratamientos_generales_json`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_diag_infantil`
--

LOCK TABLES `formulario_diag_infantil` WRITE;
/*!40000 ALTER TABLE `formulario_diag_infantil` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_diag_infantil` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_diag_infantil_detalle`
--

DROP TABLE IF EXISTS `formulario_diag_infantil_detalle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_diag_infantil_detalle` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `diente` smallint NOT NULL,
  `tratamiento` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costo` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_diaginf_det_form` (`formulario_id`),
  KEY `idx_diaginf_det_diente` (`diente`),
  CONSTRAINT `fk_diaginf_det_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_diag_infantil_detalle`
--

LOCK TABLES `formulario_diag_infantil_detalle` WRITE;
/*!40000 ALTER TABLE `formulario_diag_infantil_detalle` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_diag_infantil_detalle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_diag_infantil_generales`
--

DROP TABLE IF EXISTS `formulario_diag_infantil_generales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_diag_infantil_generales` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `tratamiento` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costo` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_diaginf_gen_form` (`formulario_id`),
  CONSTRAINT `fk_diaginf_gen_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_diag_infantil_generales`
--

LOCK TABLES `formulario_diag_infantil_generales` WRITE;
/*!40000 ALTER TABLE `formulario_diag_infantil_generales` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_diag_infantil_generales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_evolucion`
--

DROP TABLE IF EXISTS `formulario_evolucion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_evolucion` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `numero_paciente` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_registro` date DEFAULT NULL,
  `evoluciones_json` json NOT NULL,
  `firma_paciente_at` datetime DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_evo_paciente` (`paciente_id`),
  KEY `idx_evo_medico` (`medico_id`),
  CONSTRAINT `fk_evo_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_evo_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_evo_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `formulario_evolucion_chk_1` CHECK (json_valid(`evoluciones_json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_evolucion`
--

LOCK TABLES `formulario_evolucion` WRITE;
/*!40000 ALTER TABLE `formulario_evolucion` DISABLE KEYS */;
INSERT INTO `formulario_evolucion` VALUES (27,12,1,'12','2025-10-19','[{\"ac\": \"SI\", \"costo\": 500, \"fecha\": \"2025-10-20\", \"proxima\": \"SI\", \"tratamiento\": \"Ortodoncia\"}]',NULL,'2025-10-19 20:47:11','2025-10-19 20:47:11'),(29,21,1,'21','2025-10-19','[{\"ac\": \"preubas a realizar\", \"costo\": 5380, \"fecha\": \"2025-10-20\", \"proxima\": \"pruebas\", \"tratamiento\": \"Cirugía\"}]',NULL,'2025-10-19 21:04:04','2025-10-19 21:04:04'),(49,25,1,'25','2025-10-20','[{\"ac\": \"preubas a realizar\", \"costo\": 500, \"fecha\": \"2025-10-29\", \"proxima\": \"preubas a realizar\", \"tratamiento\": \"Blanqueamiento\"}]',NULL,'2025-10-20 02:21:14','2025-10-20 02:21:14'),(60,22,1,'22','2025-10-21','[{\"ac\": \"preubas a realizar\", \"costo\": 5000, \"fecha\": \"2025-10-21\", \"proxima\": \"preubas a realizar\", \"tratamiento\": \"Cirugía\"}]',NULL,'2025-10-21 12:06:07','2025-10-21 12:06:07');
/*!40000 ALTER TABLE `formulario_evolucion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_evolucion_detalle`
--

DROP TABLE IF EXISTS `formulario_evolucion_detalle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_evolucion_detalle` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `fecha` date NOT NULL,
  `tratamiento` text COLLATE utf8mb4_unicode_ci,
  `costo` decimal(10,2) DEFAULT NULL,
  `ac` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proxima_cita_tx` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_evo_det_form` (`formulario_id`),
  KEY `idx_evo_det_fecha` (`fecha`),
  CONSTRAINT `fk_evo_det_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_evolucion_detalle`
--

LOCK TABLES `formulario_evolucion_detalle` WRITE;
/*!40000 ALTER TABLE `formulario_evolucion_detalle` DISABLE KEYS */;
INSERT INTO `formulario_evolucion_detalle` VALUES (1,27,'2025-10-20','Ortodoncia',500.00,'SI','SI'),(2,29,'2025-10-20','Cirugía',5380.00,'preubas a realizar','pruebas'),(3,49,'2025-10-29','Blanqueamiento',500.00,'preubas a realizar','preubas a realizar'),(4,60,'2025-10-21','Cirugía',5000.00,'preubas a realizar','preubas a realizar');
/*!40000 ALTER TABLE `formulario_evolucion_detalle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_historia_clinica`
--

DROP TABLE IF EXISTS `formulario_historia_clinica`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_historia_clinica` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `nombre_paciente` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `domicilio` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sexo` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `edad` int DEFAULT NULL,
  `estado_civil` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ocupacion` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo_consulta` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `antecedentes_patologicos` text COLLATE utf8mb4_unicode_ci,
  `antecedentes_patologicos_json` json DEFAULT NULL,
  `tratamiento_medico_si` tinyint(1) DEFAULT NULL,
  `tratamiento_medico_cual` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medicamento_si` tinyint(1) DEFAULT NULL,
  `medicamento_cual` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `problema_dental_si` tinyint(1) DEFAULT NULL,
  `problema_dental_cual` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `solo_mujeres_json` json DEFAULT NULL,
  `no_patologicos_json` json DEFAULT NULL,
  `antecedentes_familiares_json` json DEFAULT NULL,
  `sis_cardiovascular` text COLLATE utf8mb4_unicode_ci,
  `sis_circulatorio` text COLLATE utf8mb4_unicode_ci,
  `sis_respiratorio` text COLLATE utf8mb4_unicode_ci,
  `sis_digestivo` text COLLATE utf8mb4_unicode_ci,
  `sis_urinario` text COLLATE utf8mb4_unicode_ci,
  `sis_genital` text COLLATE utf8mb4_unicode_ci,
  `sis_musculoesqueletico` text COLLATE utf8mb4_unicode_ci,
  `sis_snc` text COLLATE utf8mb4_unicode_ci,
  `expl_cabeza_cuello_cara_perfil` text COLLATE utf8mb4_unicode_ci,
  `expl_atm` text COLLATE utf8mb4_unicode_ci,
  `expl_labios_frenillos_lengua_paladar_orofaringe_yugal` text COLLATE utf8mb4_unicode_ci,
  `expl_piso_boca_glandulas_salivales_carrillos` text COLLATE utf8mb4_unicode_ci,
  `expl_encias_procesos_alveolares` text COLLATE utf8mb4_unicode_ci,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `hallazgos` text COLLATE utf8mb4_unicode_ci,
  `firma_paciente_at` datetime DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_hc_paciente` (`paciente_id`),
  KEY `idx_hc_medico` (`medico_id`),
  CONSTRAINT `fk_hc_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hc_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_hc_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `formulario_historia_clinica_chk_1` CHECK (((`antecedentes_patologicos_json` is null) or json_valid(`antecedentes_patologicos_json`))),
  CONSTRAINT `formulario_historia_clinica_chk_2` CHECK (((`solo_mujeres_json` is null) or json_valid(`solo_mujeres_json`))),
  CONSTRAINT `formulario_historia_clinica_chk_3` CHECK (((`no_patologicos_json` is null) or json_valid(`no_patologicos_json`))),
  CONSTRAINT `formulario_historia_clinica_chk_4` CHECK (((`antecedentes_familiares_json` is null) or json_valid(`antecedentes_familiares_json`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_historia_clinica`
--

LOCK TABLES `formulario_historia_clinica` WRITE;
/*!40000 ALTER TABLE `formulario_historia_clinica` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_historia_clinica` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_justificante`
--

DROP TABLE IF EXISTS `formulario_justificante`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_justificante` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `fecha_emision` date NOT NULL,
  `nombre_paciente` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `procedimiento` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_procedimiento` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dias_reposo` int NOT NULL,
  `numero_paciente` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firma_profesional_at` datetime DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_jus_fecha` (`fecha_emision`),
  KEY `idx_jus_paciente` (`paciente_id`),
  KEY `idx_jus_medico` (`medico_id`),
  CONSTRAINT `fk_jus_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_jus_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_jus_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_justificante`
--

LOCK TABLES `formulario_justificante` WRITE;
/*!40000 ALTER TABLE `formulario_justificante` DISABLE KEYS */;
INSERT INTO `formulario_justificante` VALUES (12,26,1,'2025-10-19','Lorena Figueroa','Extracción de muelas','19 de octubre',3,NULL,NULL,'2025-10-19 13:34:03','2025-10-19 13:34:03'),(13,26,1,'2025-10-19','Lorena Figueroa','SON PRUEBAS','18 y 19 de octubre',5,NULL,NULL,'2025-10-19 13:37:40','2025-10-19 13:37:40'),(18,17,1,'2025-10-19','Marco Luna','PRUEBAS A REALIZAR','15 Y 16 DE OCTUBRE',3,NULL,NULL,'2025-10-19 14:59:11','2025-10-19 14:59:11'),(25,23,1,'2025-10-19','Eduardo Campos','PRUEBAS','10 DE OCTUBRE',5,NULL,NULL,'2025-10-19 16:43:15','2025-10-19 16:43:15'),(43,26,1,'2025-10-19','Lorena Figueroa','pruebas','10 de mayo',5,NULL,NULL,'2025-10-19 23:19:46','2025-10-19 23:19:46'),(54,25,1,'2025-10-20','Ramón Cruz','preubas a realizar','preubas a realizar',5,NULL,NULL,'2025-10-20 02:24:02','2025-10-20 02:24:02'),(63,22,1,'2025-10-21','Mónica Silva','preubas a realizar','10 de octubre',5,NULL,NULL,'2025-10-21 12:08:56','2025-10-21 12:08:56'),(65,25,1,'2025-10-24','Ramón Cruz','preubas a realizar','preubas a realizar',5,NULL,NULL,'2025-10-24 17:54:39','2025-10-24 17:54:39');
/*!40000 ALTER TABLE `formulario_justificante` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_odontograma_final`
--

DROP TABLE IF EXISTS `formulario_odontograma_final`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_odontograma_final` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `nombre_paciente` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_termino` date NOT NULL,
  `odontograma_json` json DEFAULT NULL,
  `tratamientos_json` json DEFAULT NULL,
  `encia` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inflamacion` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `migracion` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `secrecion` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `calculo` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bolsa` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_odf_fecha` (`fecha_termino`),
  KEY `idx_odf_paciente` (`paciente_id`),
  KEY `idx_odf_medico` (`medico_id`),
  CONSTRAINT `fk_odf_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_odf_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_odf_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `formulario_odontograma_final_chk_1` CHECK (((`odontograma_json` is null) or json_valid(`odontograma_json`))),
  CONSTRAINT `formulario_odontograma_final_chk_2` CHECK (((`tratamientos_json` is null) or json_valid(`tratamientos_json`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_odontograma_final`
--

LOCK TABLES `formulario_odontograma_final` WRITE;
/*!40000 ALTER TABLE `formulario_odontograma_final` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_odontograma_final` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_odontograma_final_detalle`
--

DROP TABLE IF EXISTS `formulario_odontograma_final_detalle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_odontograma_final_detalle` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `diente` smallint NOT NULL,
  `tratamiento` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_odf_det_form` (`formulario_id`),
  KEY `idx_odf_det_diente` (`diente`),
  CONSTRAINT `fk_odf_det_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_odontograma_final_detalle`
--

LOCK TABLES `formulario_odontograma_final_detalle` WRITE;
/*!40000 ALTER TABLE `formulario_odontograma_final_detalle` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_odontograma_final_detalle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_odontograma_final_encia`
--

DROP TABLE IF EXISTS `formulario_odontograma_final_encia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_odontograma_final_encia` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `condicion` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `valoracion` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_odf_enc_form` (`formulario_id`),
  CONSTRAINT `fk_odf_enc_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_odontograma_final_encia`
--

LOCK TABLES `formulario_odontograma_final_encia` WRITE;
/*!40000 ALTER TABLE `formulario_odontograma_final_encia` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_odontograma_final_encia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_ortodoncia`
--

DROP TABLE IF EXISTS `formulario_ortodoncia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_ortodoncia` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `nombre_paciente` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_ingreso` date NOT NULL,
  `fecha_alta` date DEFAULT NULL,
  `tipo_cuerpo` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo_cara` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo_craneo` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `examen_otros` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fun_respiracion` text COLLATE utf8mb4_unicode_ci,
  `fun_deglucion` text COLLATE utf8mb4_unicode_ci,
  `fun_masticacion` text COLLATE utf8mb4_unicode_ci,
  `fun_fonacion` text COLLATE utf8mb4_unicode_ci,
  `atm_problemas_actuales` text COLLATE utf8mb4_unicode_ci,
  `atm_dolor_si` tinyint(1) DEFAULT NULL,
  `atm_ruidos_si` tinyint(1) DEFAULT NULL,
  `atm_dolor_palpacion` text COLLATE utf8mb4_unicode_ci,
  `atm_max_apertura_mm` decimal(6,2) DEFAULT NULL,
  `atm_lateralidad_izq_mm` decimal(6,2) DEFAULT NULL,
  `atm_protrusion_mm` decimal(6,2) DEFAULT NULL,
  `atm_lateralidad_der_mm` decimal(6,2) DEFAULT NULL,
  `dis_ocrc_vertical_mm` decimal(6,2) DEFAULT NULL,
  `dis_ocrc_horizontal_mm` decimal(6,2) DEFAULT NULL,
  `dis_ocrc_otro` text COLLATE utf8mb4_unicode_ci,
  `mod_ocl_molares_der_mm` decimal(6,2) DEFAULT NULL,
  `mod_ocl_molares_izq_mm` decimal(6,2) DEFAULT NULL,
  `mod_ocl_caninos_der_mm` decimal(6,2) DEFAULT NULL,
  `mod_ocl_caninos_izq_mm` decimal(6,2) DEFAULT NULL,
  `mod_resalte_horizontal_mm` decimal(6,2) DEFAULT NULL,
  `mod_resalte_vertical_mm` decimal(6,2) DEFAULT NULL,
  `mod_linea_media_sup_mm` decimal(6,2) DEFAULT NULL,
  `mod_linea_media_inf_mm` decimal(6,2) DEFAULT NULL,
  `mod_mordida_cruzada_post_der_mm` decimal(6,2) DEFAULT NULL,
  `mod_mordida_cruzada_post_izq_mm` decimal(6,2) DEFAULT NULL,
  `mod_anom_ausentes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mod_anom_malformacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mod_anom_giroversion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mod_anom_infraversion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mod_anom_supraversion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mod_anom_pigmentados` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arcada_sup` enum('oval','cuadrada','triangular') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arcada_inf` enum('oval','cuadrada','triangular') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pont_premaxila_nc` decimal(6,2) DEFAULT NULL,
  `pont_premaxila_pac` decimal(6,2) DEFAULT NULL,
  `pont_premaxila_dif` decimal(6,2) DEFAULT NULL,
  `pont_premolares_nc` decimal(6,2) DEFAULT NULL,
  `pont_premolares_pac` decimal(6,2) DEFAULT NULL,
  `pont_premolares_dif` decimal(6,2) DEFAULT NULL,
  `pont_molares_nc` decimal(6,2) DEFAULT NULL,
  `pont_molares_pac` decimal(6,2) DEFAULT NULL,
  `pont_molares_dif` decimal(6,2) DEFAULT NULL,
  `col_mand_premolares_pac` decimal(6,2) DEFAULT NULL,
  `col_mand_premolares_dif` decimal(6,2) DEFAULT NULL,
  `col_mand_molares_pac` decimal(6,2) DEFAULT NULL,
  `col_mand_molares_dif` decimal(6,2) DEFAULT NULL,
  `suma_incisivos` decimal(6,2) DEFAULT NULL,
  `bolton_sup_json` json DEFAULT NULL,
  `bolton_inf_json` json DEFAULT NULL,
  `bolton_global_ref` decimal(5,2) DEFAULT '91.30',
  `bolton_parcial_ref` decimal(5,2) DEFAULT '77.20',
  `bolton_dif_mm` decimal(6,2) DEFAULT NULL,
  `long_apinamiento_mm` decimal(6,2) DEFAULT NULL,
  `long_protrusion_dental_mm` decimal(6,2) DEFAULT NULL,
  `long_curva_spee_mm` decimal(6,2) DEFAULT NULL,
  `long_total_mm` decimal(6,2) DEFAULT NULL,
  `plan_ortopedia_maxilar` text COLLATE utf8mb4_unicode_ci,
  `plan_ortopedia_mandibula` text COLLATE utf8mb4_unicode_ci,
  `plan_inf_incisivo` text COLLATE utf8mb4_unicode_ci,
  `plan_inf_molar` text COLLATE utf8mb4_unicode_ci,
  `plan_sup_molar` text COLLATE utf8mb4_unicode_ci,
  `plan_sup_incisivo` text COLLATE utf8mb4_unicode_ci,
  `plan_sup_estetica` text COLLATE utf8mb4_unicode_ci,
  `anclaje_max` enum('maximo','moderado','minimo') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `anclaje_man` enum('maximo','moderado','minimo') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biotipo_facial_json` json DEFAULT NULL,
  `clase_esqueletica_json` json DEFAULT NULL,
  `problemas_verticales_json` json DEFAULT NULL,
  `factores_dentales_json` json DEFAULT NULL,
  `diagnostico` text COLLATE utf8mb4_unicode_ci,
  `clase_ii_json` json DEFAULT NULL,
  `clase_iii_json` json DEFAULT NULL,
  `compl_verticales_json` json DEFAULT NULL,
  `jaraback_json` json DEFAULT NULL,
  `medidas_lineales_json` json DEFAULT NULL,
  `mcnamara_json` json DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_orto_ingreso` (`fecha_ingreso`),
  KEY `idx_orto_paciente` (`paciente_id`),
  KEY `idx_orto_medico` (`medico_id`),
  CONSTRAINT `fk_orto_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_orto_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orto_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `formulario_ortodoncia_chk_1` CHECK (((`bolton_sup_json` is null) or json_valid(`bolton_sup_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_10` CHECK (((`jaraback_json` is null) or json_valid(`jaraback_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_11` CHECK (((`medidas_lineales_json` is null) or json_valid(`medidas_lineales_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_12` CHECK (((`mcnamara_json` is null) or json_valid(`mcnamara_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_2` CHECK (((`bolton_inf_json` is null) or json_valid(`bolton_inf_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_3` CHECK (((`biotipo_facial_json` is null) or json_valid(`biotipo_facial_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_4` CHECK (((`clase_esqueletica_json` is null) or json_valid(`clase_esqueletica_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_5` CHECK (((`problemas_verticales_json` is null) or json_valid(`problemas_verticales_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_6` CHECK (((`factores_dentales_json` is null) or json_valid(`factores_dentales_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_7` CHECK (((`clase_ii_json` is null) or json_valid(`clase_ii_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_8` CHECK (((`clase_iii_json` is null) or json_valid(`clase_iii_json`))),
  CONSTRAINT `formulario_ortodoncia_chk_9` CHECK (((`compl_verticales_json` is null) or json_valid(`compl_verticales_json`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_ortodoncia`
--

LOCK TABLES `formulario_ortodoncia` WRITE;
/*!40000 ALTER TABLE `formulario_ortodoncia` DISABLE KEYS */;
INSERT INTO `formulario_ortodoncia` VALUES (31,23,1,'Eduardo Campos','2025-10-19','2025-10-30',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 22:24:05','2025-10-19 22:24:05'),(32,8,1,'Gabriela Castañeda','2025-10-19','2025-10-21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[null, null, null, null, null, null, null, null, null, null, null, null]','[null, null, null, null, null, null, null, null, null, null, null, null]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]',NULL,'[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','2025-10-19 22:29:57','2025-10-19 22:29:57'),(33,8,1,'Gabriela Castañeda','2025-10-19','2025-10-30',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[null, null, null, null, null, null, null, null, null, null, null, null]','[null, null, null, null, null, null, null, null, null, null, null, null]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\", \"resultado\": \"\", \"diferencia\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]',NULL,'[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','[{\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}, {\"dc\": \"\", \"nc\": \"\", \"factor\": \"\", \"paciente\": \"\"}]','2025-10-19 22:39:53','2025-10-19 22:39:53'),(34,8,1,'Gabriela Castañeda','2025-10-19','2025-10-21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 22:40:12','2025-10-19 22:40:12'),(35,8,1,'Gabriela Castañeda','2025-10-19','2025-10-22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 22:45:48','2025-10-19 22:45:48'),(36,23,1,'Eduardo Campos','2025-10-19','2025-10-21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 22:46:55','2025-10-19 22:46:55'),(37,26,1,'Lorena Figueroa','2025-10-19','2025-10-24',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 22:51:41','2025-10-19 22:51:41'),(39,26,1,'Lorena Figueroa','2025-10-19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 22:53:48','2025-10-19 22:53:48'),(40,26,1,'Lorena Figueroa','2025-10-19','2025-11-05',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 23:04:54','2025-10-19 23:04:54'),(41,26,1,'Lorena Figueroa','2025-10-19','2025-11-05',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 23:11:50','2025-10-19 23:11:50'),(42,26,1,'Lorena Figueroa','2025-10-19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 23:18:05','2025-10-19 23:18:05'),(44,26,1,'Lorena Figueroa','2025-10-19','2025-10-22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-19 23:22:14','2025-10-19 23:22:14'),(45,21,1,'Tomás Bravo','2025-10-20','2025-10-22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-20 00:07:08','2025-10-20 00:07:08'),(46,21,1,'Tomás Bravo','2025-10-20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-20 01:17:12','2025-10-20 01:17:12'),(47,21,1,'Tomás Bravo','2025-10-20','2025-10-24',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-20 01:27:11','2025-10-20 01:27:11'),(48,21,1,'Tomás Bravo','2025-10-20','2025-10-30',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-20 01:30:59','2025-10-20 01:30:59'),(58,25,1,'Ramón Cruz','2025-10-21','2025-11-08','SON PRUEBAS','SON PRUEBAS','SON PRUEBAS','SON PRUEBAS','SON PRUEBAS','SON PRUEBAS','SON PRUEBAS','SON PRUEBAS','SON PRUEBAS',1,1,'SON PRUEBAS',NULL,NULL,NULL,NULL,NULL,NULL,'SON PRUEBAS',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[\"\", \"\", \"\", \"\", \"\", \"\"]','[\"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\"]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-21 12:03:41','2025-10-21 12:03:41'),(64,22,1,'Mónica Silva','2025-10-21','2025-11-06','son pruebas a realizar','son pruebas a realizar','son pruebas a realizar','son pruebas a realizar','son pruebas a realizar','son pruebas a realizar','son pruebas a realizar','son pruebas a realizar',NULL,1,1,'son pruebas a realizar',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[\"\", \"\", \"\", \"\", \"\", \"\"]','[\"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\", \"\"]',91.30,77.20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]','[]','[]','[]',NULL,'[]','[]','[]','[]','[]','[]','2025-10-21 12:09:45','2025-10-21 12:09:45');
/*!40000 ALTER TABLE `formulario_ortodoncia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_presupuesto_dental`
--

DROP TABLE IF EXISTS `formulario_presupuesto_dental`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_presupuesto_dental` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `fecha` date NOT NULL,
  `numero_paciente` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meses` int NOT NULL DEFAULT '1',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_mensual` decimal(10,2) NOT NULL DEFAULT '0.00',
  `odontograma_json` json DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_presu_fecha` (`fecha`),
  KEY `idx_presu_paciente` (`paciente_id`),
  KEY `idx_presu_medico` (`medico_id`),
  CONSTRAINT `fk_presu_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_presu_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_presu_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `formulario_presupuesto_dental_chk_1` CHECK (((`odontograma_json` is null) or json_valid(`odontograma_json`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_presupuesto_dental`
--

LOCK TABLES `formulario_presupuesto_dental` WRITE;
/*!40000 ALTER TABLE `formulario_presupuesto_dental` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_presupuesto_dental` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_presupuesto_dental_dientes`
--

DROP TABLE IF EXISTS `formulario_presupuesto_dental_dientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_presupuesto_dental_dientes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `diente` varchar(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tratamiento` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costo` decimal(10,2) NOT NULL DEFAULT '0.00',
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_presu_diente_form` (`formulario_id`),
  KEY `idx_presu_diente_pza` (`diente`),
  CONSTRAINT `fk_presu_diente_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_presupuesto_dental_dientes`
--

LOCK TABLES `formulario_presupuesto_dental_dientes` WRITE;
/*!40000 ALTER TABLE `formulario_presupuesto_dental_dientes` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_presupuesto_dental_dientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_presupuesto_dental_generales`
--

DROP TABLE IF EXISTS `formulario_presupuesto_dental_generales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_presupuesto_dental_generales` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `tratamiento` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costo` decimal(10,2) NOT NULL DEFAULT '0.00',
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_presu_gen_form` (`formulario_id`),
  CONSTRAINT `fk_presu_gen_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_presupuesto_dental_generales`
--

LOCK TABLES `formulario_presupuesto_dental_generales` WRITE;
/*!40000 ALTER TABLE `formulario_presupuesto_dental_generales` DISABLE KEYS */;
/*!40000 ALTER TABLE `formulario_presupuesto_dental_generales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_receta`
--

DROP TABLE IF EXISTS `formulario_receta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_receta` (
  `formulario_id` bigint NOT NULL,
  `paciente_id` int NOT NULL,
  `medico_id` int DEFAULT NULL,
  `fecha` date NOT NULL,
  `edad_texto` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `edad_anios` int DEFAULT NULL,
  `nombre_medico` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cedula` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firma_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firma_hash` varbinary(32) DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`formulario_id`),
  KEY `idx_receta_fecha` (`fecha`),
  KEY `idx_receta_paciente` (`paciente_id`),
  KEY `idx_receta_medico` (`medico_id`),
  CONSTRAINT `fk_receta_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_receta_medico` FOREIGN KEY (`medico_id`) REFERENCES `medicos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_receta_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_receta`
--

LOCK TABLES `formulario_receta` WRITE;
/*!40000 ALTER TABLE `formulario_receta` DISABLE KEYS */;
INSERT INTO `formulario_receta` VALUES (4,2,1,'2025-10-19','29 años',29,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 03:56:58','2025-10-19 03:56:58'),(5,27,1,'2025-10-19','33 años',33,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 04:04:30','2025-10-19 04:04:30'),(6,22,1,'2025-10-19','40 años',40,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 04:30:18','2025-10-19 04:30:18'),(7,15,1,'2025-10-19','41 años',41,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 04:31:17','2025-10-19 04:31:17'),(8,15,1,'2025-10-19','41 años',41,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 04:47:40','2025-10-19 04:47:40'),(9,15,1,'2025-10-19','41 años',41,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 04:48:22','2025-10-19 04:48:22'),(10,24,1,'2025-10-19','35 años',35,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 04:52:09','2025-10-19 04:52:09'),(11,26,1,'2025-10-19','30 años',30,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 13:12:31','2025-10-19 13:12:31'),(16,17,1,'2025-10-19','32 años',32,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 14:57:28','2025-10-19 14:57:28'),(19,12,1,'2025-10-19','26 años',26,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 15:50:17','2025-10-19 15:50:17'),(24,23,1,'2025-10-19','47 años',47,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 16:38:13','2025-10-19 16:38:13'),(38,26,1,'2025-10-19','30 años',30,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-19 22:53:34','2025-10-19 22:53:34'),(50,25,1,'2025-10-20','49 años',49,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-20 02:21:42','2025-10-20 02:21:42'),(59,22,1,'2025-10-21','40 años',40,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-21 12:05:08','2025-10-21 12:05:08'),(66,10,1,'2025-10-24','45 años',45,'Dr. Juan Pérez Martínez','CED123456',NULL,NULL,'2025-10-24 18:31:22','2025-10-24 18:31:22');
/*!40000 ALTER TABLE `formulario_receta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_receta_medicamentos`
--

DROP TABLE IF EXISTS `formulario_receta_medicamentos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_receta_medicamentos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `formulario_id` bigint NOT NULL,
  `medicamento` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dosis` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `frecuencia` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duracion` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `indicaciones` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_receta_det_form` (`formulario_id`),
  CONSTRAINT `fk_receta_det_form` FOREIGN KEY (`formulario_id`) REFERENCES `formulario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_receta_medicamentos`
--

LOCK TABLES `formulario_receta_medicamentos` WRITE;
/*!40000 ALTER TABLE `formulario_receta_medicamentos` DISABLE KEYS */;
INSERT INTO `formulario_receta_medicamentos` VALUES (1,4,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 03:56:58','2025-10-19 03:56:58'),(2,5,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:04:30','2025-10-19 04:04:30'),(3,5,'Paracetamol','3','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:04:30','2025-10-19 04:04:30'),(4,6,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:30:18','2025-10-19 04:30:18'),(5,6,'Paracetamol','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:30:18','2025-10-19 04:30:18'),(6,6,'Tapcin','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:30:18','2025-10-19 04:30:18'),(7,7,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:31:17','2025-10-19 04:31:17'),(8,8,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:47:40','2025-10-19 04:47:40'),(9,9,'pruebas','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:48:22','2025-10-19 04:48:22'),(10,10,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:52:09','2025-10-19 04:52:09'),(11,10,'Paracetamol','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:52:09','2025-10-19 04:52:09'),(12,10,'Tapcin','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 04:52:09','2025-10-19 04:52:09'),(13,11,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 13:12:31','2025-10-19 13:12:31'),(14,16,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 14:57:28','2025-10-19 14:57:28'),(15,19,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 15:50:17','2025-10-19 15:50:17'),(16,24,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 16:38:13','2025-10-19 16:38:13'),(17,24,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 16:38:13','2025-10-19 16:38:13'),(18,38,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-19 22:53:34','2025-10-19 22:53:34'),(19,50,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-20 02:21:42','2025-10-20 02:21:42'),(20,59,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-21 12:05:08','2025-10-21 12:05:08'),(21,59,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-21 12:05:08','2025-10-21 12:05:08'),(22,66,'Naproxeno','5','1 cada 8 horas','5 dias','Consumir despues de comer','2025-10-24 18:31:22','2025-10-24 18:31:22');
/*!40000 ALTER TABLE `formulario_receta_medicamentos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formulario_tipo`
--

DROP TABLE IF EXISTS `formulario_tipo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formulario_tipo` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formulario_tipo`
--

LOCK TABLES `formulario_tipo` WRITE;
/*!40000 ALTER TABLE `formulario_tipo` DISABLE KEYS */;
INSERT INTO `formulario_tipo` VALUES (1,'consentimiento_quirurgico','Consentimiento informado para procedimientos quirúrgicos',1),(2,'historia_clinica','Historia clínica dental integral',1),(3,'consentimiento_odontologico','Consentimiento informado para procedimientos/tratamientos odontológicos',1),(4,'diagnostico_infantil','Diagnóstico y plan para paciente infantil (PX Infantil)',1),(5,'evolucion_clinica','Hoja de evolución clínica del paciente',1),(6,'justificante_medico','Constancia/justificante médico dental',1),(7,'odontograma_final','Odontograma final con tratamientos y estado de encía',1),(8,'historia_ortodoncia','Historia clínica de ortodoncia: análisis clínico/funcional/modelos/cefalometría/plan',1),(9,'presupuesto_dental','Presupuesto por diente y tratamientos generales con cálculo de totales',1),(10,'receta_medica','Receta médica odontológica con medicamentos y firma',1),(13,'diag_plan_infantil','Diagnóstico y plan (odontograma infantil, costos)',1),(14,'evolucion','Hoja de evolución clínica (múltiples registros)',1),(15,'justificante','Justificante médico/odontológico',1),(17,'ortodoncia','Historia/diagnóstico ortodoncia (clínico, funcional, modelos, índices, cefalométrico)',1);
/*!40000 ALTER TABLE `formulario_tipo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicos`
--

DROP TABLE IF EXISTS `medicos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellido` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cedula` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `especialidad` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `genero` enum('Masculino','Femenino','Otro') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rfc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono_principal` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono_secundario` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firma_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_medico_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicos`
--

LOCK TABLES `medicos` WRITE;
/*!40000 ALTER TABLE `medicos` DISABLE KEYS */;
INSERT INTO `medicos` VALUES (1,'Carlos','Ramírez','1234567','Odontología General','Masculino','doctor@smileworks.local','CARL850101XX1','5551234567','5523456789','Av. Reforma 123, CDMX',NULL,'2025-10-14 01:31:58','2025-10-19 08:15:16',2);
/*!40000 ALTER TABLE `medicos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pacientes`
--

DROP TABLE IF EXISTS `pacientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pacientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `apellido` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sexo` enum('M','F','Otro') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `edad` int unsigned DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono_principal` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono_secundario` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pacientes`
--

LOCK TABLES `pacientes` WRITE;
/*!40000 ALTER TABLE `pacientes` DISABLE KEYS */;
INSERT INTO `pacientes` VALUES (1,'Fernando','Ríos','M',35,'fernando.rios@correo.com','5574898919','5581234567'),(2,'Isabel','Cervantes','F',29,'isabel.cervantes@correo.com','5574898920','5582345678'),(3,'Roberto','Mendoza','M',42,'roberto.mendoza@correo.com','5574898921','5583456789'),(4,'Patricia','Delgado','F',37,'patricia.delgado@correo.com','5574898922','5584567890'),(5,'Jorge','Navarro','M',40,'jorge.navarro@correo.com','5574898923','5585678901'),(6,'Claudia','Salinas','F',31,'claudia.salinas@correo.com','5574898924','5586789012'),(7,'Andrés','Vega','M',27,'andres.vega@correo.com','5574898925','5587890123'),(8,'Gabriela','Castañeda','F',33,'gabriela.castaneda@correo.com','5574898926','5588901234'),(9,'Raúl','Domínguez','M',50,'raul.dominguez@correo.com','5574898927','5589012345'),(10,'Verónica','Estrada','F',45,'veronica.estrada@correo.com','5574898928','5590123456'),(11,'Héctor','Zamora','M',38,'hector.zamora@correo.com','5574898929','5591234567'),(12,'Natalia','Aguilar','F',26,'natalia.aguilar@correo.com','5574898930','5592345678'),(13,'Emilio','Rosales','M',30,'emilio.rosales@correo.com','5574898931','5593456789'),(14,'Daniela','Pineda','F',34,'daniela.pineda@correo.com','5574898932','5594567890'),(15,'Esteban','Carrillo','M',41,'esteban.carrillo@correo.com','5574898933','5595678901'),(16,'Lucía','González','F',28,'lucia.gonzalez@correo.com','5574898934','5596789012'),(17,'Marco','Luna','M',32,'marco.luna@correo.com','5574898935','5597890123'),(18,'Paola','Reyes','F',36,'paola.reyes@correo.com','5574898936','5598901234'),(19,'Iván','Santos','M',44,'ivan.santos@correo.com','5574898937','5599012345'),(20,'Carla','Nieto','F',39,'carla.nieto@correo.com','5574898938','5590123456'),(21,'Tomás','Bravo','M',25,'tomas.bravo@correo.com','5574898939','5591234567'),(22,'Mónica','Silva','F',40,'monica.silva@correo.com','5574898940','5592345678'),(23,'Eduardo','Campos','M',47,'eduardo.campos@correo.com','5574898941','5593456789'),(24,'Sandra','Peña','F',35,'sandra.pena@correo.com','5574898942','5594567890'),(25,'Ramón','Cruz','M',49,'ramon.cruz@correo.com','5574898943','5595678901'),(26,'Lorena','Figueroa','F',30,'lorena.figueroa@correo.com','5574898944','5596789012'),(27,'Óscar','Mejía','M',33,'oscar.mejia@correo.com','5574898945','5597890123'),(28,'Beatriz','Solís','F',38,'beatriz.solis@correo.com','5574898946','5598901234'),(29,'Alberto','Palacios','M',43,'alberto.palacios@correo.com','5574898947','5599012345'),(30,'Rosa','Del Valle','F',41,'rosa.delvalle@correo.com','5574898948','5590123456');
/*!40000 ALTER TABLE `pacientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_files`
--

DROP TABLE IF EXISTS `patient_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `paciente_id` int NOT NULL,
  `tipo` enum('rx','panoramica','tac','cbct','foto','otro') COLLATE utf8mb4_unicode_ci DEFAULT 'otro',
  `nombre_archivo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_subida` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notas` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pf_paciente` (`paciente_id`),
  KEY `idx_pf_fecha` (`fecha_subida` DESC),
  CONSTRAINT `fk_pf_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_files`
--

LOCK TABLES `patient_files` WRITE;
/*!40000 ALTER TABLE `patient_files` DISABLE KEYS */;
/*!40000 ALTER TABLE `patient_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','Administración'),(2,'doctor','Doctor'),(3,'asistente','Asistente');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `fk_user_roles_role` (`role_id`),
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1),(2,2),(3,3);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin@smileworks.local','12345',1,'2025-10-11 02:57:05'),(2,'doctor@smileworks.local','12345',1,'2025-10-11 02:57:05'),(3,'asistente@smileworks.local','12345',1,'2025-10-11 02:57:05');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-25  9:43:01
